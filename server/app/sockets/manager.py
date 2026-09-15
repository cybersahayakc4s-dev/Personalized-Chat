import socketio
import socketio.exceptions
from datetime import datetime
from typing import Dict, Set, Optional
import time
from ..core.config import settings
from ..core.security import decode_access_token, decode_access_token_full
from ..core.database import SessionLocal
from ..models.user import User, UserStatus, TeamEnum
from ..models.message import Message
from ..models.membership import TeamMembership
from ..models.attachment import Attachment
from ..services.message_service import broadcast_chat_message
from ..core.logging_config import get_logger

logger = get_logger("app.sockets.manager")

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origins,
    logger=False,
    engineio_logger=False
)

# In-memory tracking of active user socket connections: {user_id: set(sid)}
online_users: Dict[int, Set[str]] = {}
# Mapping sid -> user_id
sid_to_user: Dict[str, int] = {}
# Mapping sid -> token expiration timestamp (float)
sid_token_exp: Dict[str, float] = {}
# User custom presence status: {user_id: "online" | "busy" | "offline"}
user_presence_status: Dict[int, str] = {}

def is_sid_token_expired(sid: str) -> bool:
    """Checks if the access token associated with this socket connection has expired."""
    exp = sid_token_exp.get(sid)
    if not exp:
        return False
    return time.time() >= exp

async def force_disconnect_expired_socket(sid: str):
    """Notifies client that the access token expired and terminates the connection."""
    user_id = sid_to_user.get(sid)
    try:
        await sio.emit("auth:token_expired", {"code": "TOKEN_EXPIRED", "message": "Access token expired. Silent refresh required."}, room=sid)
    except Exception as e:
        logger.error(f"Failed to emit auth:token_expired to sid {sid}: {e}", exc_info=True, extra={"user_id": str(user_id or "-"), "endpoint": "force_disconnect_expired_socket"})
    try:
        await sio.disconnect(sid)
    except Exception as e:
        logger.error(f"Failed to disconnect expired sid {sid}: {e}", exc_info=True, extra={"user_id": str(user_id or "-"), "endpoint": "force_disconnect_expired_socket"})

def get_online_user_ids() -> list:
    return [uid for uid, sids in online_users.items() if len(sids) > 0]

def get_all_presence_dict() -> Dict[str, str]:
    """Returns { str(user_id): 'online' | 'busy' | 'offline' } for all active users"""
    presence = {}
    for uid, sids in online_users.items():
        if sids:
            presence[str(uid)] = user_presence_status.get(uid, "online")
    # Also include any previously online user now offline so clients receive explicit state
    for uid, status in user_presence_status.items():
        if str(uid) not in presence:
            presence[str(uid)] = "offline"
    return presence

def get_user_presence_status(user_id: int) -> str:
    sids = online_users.get(user_id)
    if not sids:
        return "offline"
    return user_presence_status.get(user_id, "online")


@sio.event
async def connect(sid, environ, auth):
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get("token")
    if not token:
        # Fallback check query string
        query_string = environ.get("QUERY_STRING", "")
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param.split("=")[1]
                break

    if not token:
        raise socketio.exceptions.ConnectionRefusedError("AUTH_TOKEN_MISSING")

    payload, err_type = decode_access_token_full(token)
    if err_type == "expired":
        raise socketio.exceptions.ConnectionRefusedError("TOKEN_EXPIRED")
    if not payload or "sub" not in payload:
        raise socketio.exceptions.ConnectionRefusedError("AUTH_FAILED")

    sub_val = str(payload.get("sub", ""))
    db = SessionLocal()
    try:
        if sub_val.isdigit():
            user = db.query(User).filter(User.id == int(sub_val)).first()
        else:
            user = db.query(User).filter(User.email == sub_val.lower().strip()).first()
        if not user or user.status == UserStatus.disabled:
            raise socketio.exceptions.ConnectionRefusedError("ACCOUNT_DISABLED")

        # Store connection and expiration timestamp
        sid_to_user[sid] = user.id
        exp_val = payload.get("exp")
        if exp_val:
            sid_token_exp[sid] = float(exp_val)

        if user.id not in online_users:
            online_users[user.id] = set()
        online_users[user.id].add(sid)

        # Default presence to 'online' when connecting
        if user_presence_status.get(user.id) not in ["online", "busy"]:
            user_presence_status[user.id] = "online"

        # Join personal user room
        await sio.enter_room(sid, f"user_{user.id}")

        # If Main-Admin, join all 5 team rooms
        if user.is_main_admin:
            for t in TeamEnum:
                await sio.enter_room(sid, f"team_{t.value}")
        elif user.team:
            await sio.enter_room(sid, f"team_{user.team.value}")

        # Broadcast presence
        await sio.emit("presence:update", {
            "online_user_ids": get_online_user_ids(),
            "presence": get_all_presence_dict()
        })
        return True
    finally:
        db.close()

@sio.event
async def disconnect(sid):
    sid_token_exp.pop(sid, None)
    user_id = sid_to_user.pop(sid, None)
    if user_id and user_id in online_users:
        online_users[user_id].discard(sid)
        if not online_users[user_id]:
            del online_users[user_id]
            user_presence_status[user_id] = "offline"
        # Broadcast presence change
        await sio.emit("presence:update", {
            "online_user_ids": get_online_user_ids(),
            "presence": get_all_presence_dict()
        })

@sio.event
async def heartbeat(sid, data=None):
    """Client periodic heartbeat. Forces disconnect if access token expired."""
    if is_sid_token_expired(sid):
        await force_disconnect_expired_socket(sid)
        return {"error": "TOKEN_EXPIRED"}
    return {"status": "ok"}

@sio.event
async def auth_update(sid, data):
    """Allows client to update access token after silent refresh without dropping connection."""
    new_token = data.get("token") if isinstance(data, dict) else None
    if not new_token:
        return {"error": "Token required"}
    payload, err = decode_access_token_full(new_token)
    if err == "expired" or not payload:
        return {"error": "TOKEN_EXPIRED"}
    exp_val = payload.get("exp")
    if exp_val:
        sid_token_exp[sid] = float(exp_val)
    return {"status": "ok"}

@sio.event
async def presence_set_status(sid, data):
    user_id = sid_to_user.get(sid)
    new_status = data.get("status") if isinstance(data, dict) else None
    if not user_id or new_status not in ["online", "busy", "offline"]:
        return

    user_presence_status[user_id] = new_status
    await sio.emit("presence:update", {
        "online_user_ids": get_online_user_ids(),
        "presence": get_all_presence_dict()
    })

@sio.event
async def presence_get(sid, data=None):
    await sio.emit("presence:update", {
        "online_user_ids": get_online_user_ids(),
        "presence": get_all_presence_dict()
    }, room=sid)

@sio.event
async def chat_read(sid, data):
    """Mark incoming messages from sender as read and notify sender of the seen ticks"""
    user_id = sid_to_user.get(sid)
    sender_id = data.get("sender_id")
    if not user_id or not sender_id:
        return

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        updated = db.query(Message).filter(
            Message.sender_id == sender_id,
            Message.receiver_id == user_id,
            Message.read_at.is_(None)
        ).update({"read_at": now})
        db.commit()

        if updated > 0:
            # Emit seen event to sender
            await sio.emit("message:read_confirm", {
                "reader_id": user_id,
                "read_at": now.isoformat() + "Z"
            }, room=f"user_{sender_id}")
    finally:
        db.close()

@sio.event
async def team_read(sid, data):
    """Mark team messages as read for this user in real time"""
    user_id = sid_to_user.get(sid)
    team_str = data.get("team") if isinstance(data, dict) else None
    if not user_id or not team_str:
        return

    try:
        team_enum = TeamEnum(team_str)
    except ValueError:
        return

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        receipt = db.query(TeamReadReceipt).filter(
            TeamReadReceipt.user_id == user_id,   
            TeamReadReceipt.team == team_enum
        ).first()
        if receipt:
            receipt.last_read_at = now
        else:
            receipt = TeamReadReceipt(
                user_id=user_id,
                team=team_enum,
                last_read_at=now
            )
            db.add(receipt)
        db.commit()
    finally:
        db.close()

async def broadcast_attachment_message(msg_payload):
    """Helper to broadcast file upload messages"""
    if msg_payload.get("receiver_id"):
        await sio.emit("message:receive", msg_payload, room=f"user_{msg_payload['receiver_id']}")
        await sio.emit("message:receive", msg_payload, room=f"user_{msg_payload['sender_id']}")
    elif msg_payload.get("team"):
        await sio.emit("message:receive", msg_payload, room=f"team_{msg_payload['team']}")

async def broadcast_message_edited(edit_payload):
    """Helper to broadcast message edits to relevant room"""
    if edit_payload.get("receiver_id"):
        await sio.emit("message:edited", edit_payload, room=f"user_{edit_payload['receiver_id']}")
        await sio.emit("message:edited", edit_payload, room=f"user_{edit_payload['sender_id']}")
    elif edit_payload.get("team"):
        await sio.emit("message:edited", edit_payload, room=f"team_{edit_payload['team']}")

async def broadcast_message_deleted(del_payload):
    """Helper to broadcast message deletion alert to relevant room"""
    # Guarantee both id and message_id exist in payload for client contract
    msg_id = del_payload.get("id") or del_payload.get("message_id")
    if msg_id:
        del_payload["id"] = msg_id
        del_payload["message_id"] = msg_id

    if del_payload.get("receiver_id"):
        await sio.emit("message:deleted", del_payload, room=f"user_{del_payload['receiver_id']}")
        await sio.emit("message:deleted", del_payload, room=f"user_{del_payload['sender_id']}")
    elif del_payload.get("team"):
        await sio.emit("message:deleted", del_payload, room=f"team_{del_payload['team']}")

async def kick_user_sockets(user_id: int):
    """Disconnect all active sockets for a deactivated user"""
    sids = list(online_users.get(user_id, set()))
    for s in sids:
        try:
            await sio.disconnect(s)
        except Exception as e:
            logger.error(f"Failed to disconnect kicked socket {s} for user {user_id}: {e}", exc_info=True, extra={"user_id": str(user_id), "endpoint": "kick_user_sockets"})

async def update_user_team_rooms(user_id: int, old_team: Optional[str], new_team: Optional[str]):
    """Migrates all active socket connections for a user to their new team room"""
    sids = list(online_users.get(user_id, set()))
    for sid in sids:
        try:
            if old_team:
                sio.leave_room(sid, f"team_{old_team}")
            if new_team:
                sio.enter_room(sid, f"team_{new_team}")
        except Exception as e:
            logger.error(f"Failed to migrate room for sid {sid}: {e}", exc_info=True, extra={"user_id": str(user_id), "endpoint": "update_user_team_rooms"})

async def broadcast_user_updated(user_payload: dict):
    """Broadcasts user profile and team assignment updates to all connected clients"""
    try:
        await sio.emit("user:updated", user_payload)
    except Exception as e:
        logger.error(f"Failed to broadcast user:updated: {e}", exc_info=True, extra={"endpoint": "broadcast_user_updated"})

async def broadcast_reaction_update(payload):
    """Helper to broadcast reaction changes"""
    if payload.get("receiver_id"):
        await sio.emit("message:reaction", payload, room=f"user_{payload['receiver_id']}")
        await sio.emit("message:reaction", payload, room=f"user_{payload['sender_id']}")
    elif payload.get("team"):
        await sio.emit("message:reaction", payload, room=f"team_{payload['team']}")

async def broadcast_pin_update(payload):
    """Helper to broadcast pin status changes"""
    if payload.get("receiver_id"):
        await sio.emit("message:pin", payload, room=f"user_{payload['receiver_id']}")
        await sio.emit("message:pin", payload, room=f"user_{payload['sender_id']}")
    elif payload.get("team"):
        await sio.emit("message:pin", payload, room=f"team_{payload['team']}")

@sio.event
async def typing_start(sid, data):
    user_id = sid_to_user.get(sid)
    if not user_id:
        return
    receiver_id = data.get("receiver_id")
    team_str = data.get("team")
    user_name = data.get("user_name", "Someone")
    payload = {"user_id": user_id, "user_name": user_name, "receiver_id": receiver_id, "team": team_str}
    if receiver_id:
        await sio.emit("typing:start", payload, room=f"user_{receiver_id}")
    elif team_str:
        await sio.emit("typing:start", payload, room=f"team_{team_str}")

@sio.event
async def typing_stop(sid, data):
    user_id = sid_to_user.get(sid)
    if not user_id:
        return
    receiver_id = data.get("receiver_id")
    team_str = data.get("team")
    payload = {"user_id": user_id, "receiver_id": receiver_id, "team": team_str}
    if receiver_id:
        await sio.emit("typing:stop", payload, room=f"user_{receiver_id}")
    elif team_str:
        await sio.emit("typing:stop", payload, room=f"team_{team_str}")
