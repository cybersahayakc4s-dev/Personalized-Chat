import pytest
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure server package is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Dedicated test SQLite database to completely isolate from developer database
TEST_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_temp.db"))
test_engine = create_engine(f"sqlite:///{TEST_DB_PATH}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings
from app.models.user import User, TeamEnum, UserStatus
from app.models.membership import TeamMembership
from app.models.team_settings import TeamSettings
from app.models.message import Message
from app.models.attachment import Attachment
from app.models.refresh_token import RefreshToken
from app.core.security import hash_token, generate_refresh_token

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    # Recreate tables strictly in the isolated test database
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    # Bootstrap initial admin in test db
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = TestingSessionLocal()
    admin = User(
        name=settings.INITIAL_ADMIN_NAME,
        email=settings.INITIAL_ADMIN_EMAIL,
        password_hash=pwd_context.hash(settings.INITIAL_ADMIN_PASSWORD),
        is_main_admin=True,
        team=TeamEnum.coordination,
        is_team_leader=False,
        status=UserStatus.active
    )
    db.add(admin)
    db.commit()
    db.close()
    yield
    # Cleanup test db
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except:
            pass

def get_token(email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]

def test_initial_admin_login():
    """Verify initial bootstrapped admin can log in successfully."""
    token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    user_data = me_res.json()
    assert user_data["email"] == settings.INITIAL_ADMIN_EMAIL
    assert user_data["is_main_admin"] is True

def test_admin_create_users():
    """Verify Main-Admin can create users and non-admins are blocked."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create Alice in team_ai
    alice_res = client.post("/api/main-admin/users", headers=headers, json={
        "name": "Alice Developer",
        "email": "alice@company.internal",
        "password": "Password@123",
        "team": "team_ai",
        "is_team_leader": True
    })
    assert alice_res.status_code == 200
    alice = alice_res.json()
    assert alice["team"] == "team_ai"
    assert alice["is_team_leader"] is True

    # Create Bob in team_legal
    bob_res = client.post("/api/main-admin/users", headers=headers, json={
        "name": "Bob Legal",
        "email": "bob@company.internal",
        "password": "Password@123",
        "team": "team_legal",
        "is_team_leader": False
    })
    assert bob_res.status_code == 200

    # Non-admin trying to create a user must fail (403)
    alice_token = get_token("alice@company.internal", "Password@123")
    blocked_res = client.post("/api/main-admin/users", headers={"Authorization": f"Bearer {alice_token}"}, json={
        "name": "Eve Intruder",
        "email": "eve@company.internal",
        "password": "Password@123"
    })
    assert blocked_res.status_code == 403

def test_direct_message_privacy():
    """Verify 1:1 DMs are strictly private between the two participants."""
    alice_token = get_token("alice@company.internal", "Password@123")
    bob_token = get_token("bob@company.internal", "Password@123")

    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # Alice sends Bob a private DM
    bob_id = client.get("/api/auth/me", headers=bob_headers).json()["id"]
    alice_id = client.get("/api/auth/me", headers=alice_headers).json()["id"]

    send_res = client.post("/api/messages", headers=alice_headers, json={
        "receiver_id": bob_id,
        "content": "Secret 1:1 message between Alice and Bob"
    })
    assert send_res.status_code == 200

    # Bob reads history with Alice -> can see message
    bob_dm_res = client.get(f"/api/messages/dm/{alice_id}", headers=bob_headers)
    assert bob_dm_res.status_code == 200
    messages = bob_dm_res.json()
    assert any("Secret 1:1 message" in m["content"] for m in messages)

    # Main-Admin queries their own DM history with Alice -> MUST NOT contain the message between Alice and Bob!
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_dm_res = client.get(f"/api/messages/dm/{alice_id}", headers=admin_headers)
    assert admin_dm_res.status_code == 200
    admin_messages = admin_dm_res.json()
    assert not any("Secret 1:1 message between Alice and Bob" in (m["content"] or "") for m in admin_messages)

    # Main-Admin queries GET /api/messages?receiver_id={alice_id} -> MUST ALSO NOT leak Alice-Bob messages!
    admin_query_res = client.get(f"/api/messages?receiver_id={alice_id}", headers=admin_headers)
    assert admin_query_res.status_code == 200
    admin_query_messages = admin_query_res.json()
    assert not any("Secret 1:1 message between Alice and Bob" in (m["content"] or "") for m in admin_query_messages)

def test_team_scoping_whatsapp_style():
    """
    Test WhatsApp-style history scoping:
    1. Alice is in team_ai, posts message M1.
    2. Admin moves Alice from team_ai to team_legal.
    3. Another member posts message M2 in team_ai.
    4. Alice fetches team_ai history: MUST see M1, MUST NOT see M2!
    """
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    alice_token = get_token("alice@company.internal", "Password@123")
    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    alice_id = client.get("/api/auth/me", headers=alice_headers).json()["id"]

    # 1. Alice sends M1 to team_ai
    m1_res = client.post("/api/messages", headers=alice_headers, json={
        "team": "team_ai",
        "content": "Message M1 from Alice while in team_ai"
    })
    assert m1_res.status_code == 200

    # 2. Main-Admin moves Alice to team_legal
    move_res = client.patch(f"/api/main-admin/users/{alice_id}", headers=admin_headers, json={
        "team": "team_legal"
    })
    assert move_res.status_code == 200
    assert move_res.json()["team"] == "team_legal"

    # 3. Main-Admin posts M2 to team_ai (after Alice left)
    m2_res = client.post("/api/messages", headers=admin_headers, json={
        "team": "team_ai",
        "content": "Message M2 posted to team_ai after Alice left"
    })
    assert m2_res.status_code == 200

    # 4. Alice fetches team_ai history (scoped archive)
    alice_hist_res = client.get("/api/messages/team/team_ai", headers=alice_headers)
    assert alice_hist_res.status_code == 200
    history = alice_hist_res.json()

    contents = [m["content"] for m in history if m["content"]]
    assert "Message M1 from Alice while in team_ai" in contents
    assert "Message M2 posted to team_ai after Alice left" not in contents

    # But Main-Admin can see BOTH messages in team_ai
    admin_hist_res = client.get("/api/messages/team/team_ai", headers=admin_headers)
    assert admin_hist_res.status_code == 200
    admin_contents = [m["content"] for m in admin_hist_res.json() if m["content"]]
    assert "Message M1 from Alice while in team_ai" in admin_contents
    assert "Message M2 posted to team_ai after Alice left" in admin_contents

def test_team_leader_ceiling_enforcement():
    """Verify Team Leader can adjust limit up to ceiling, but cannot exceed it."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Set Charlie as Team Leader for seo
    charlie_res = client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Charlie SEO",
        "email": "charlie@company.internal",
        "password": "Password@123",
        "team": "seo",
        "is_team_leader": True
    })
    assert charlie_res.status_code == 200

    charlie_token = get_token("charlie@company.internal", "Password@123")
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    # Charlie raises limit within ceiling (e.g. 1000MB, default ceiling is 2048MB)
    ok_res = client.patch("/api/teams/seo/settings", headers=charlie_headers, json={
        "max_file_size_mb": 1000
    })
    assert ok_res.status_code == 200
    assert ok_res.json()["max_file_size_mb"] == 1000

    # Charlie attempts to raise beyond ceiling (e.g. 3000MB) -> must be rejected (400)
    bad_res = client.patch("/api/teams/seo/settings", headers=charlie_headers, json={
        "max_file_size_mb": 3000
    })
    assert bad_res.status_code == 400
    assert "exceeds team ceiling" in bad_res.json()["detail"]

    # Charlie attempts to adjust ceiling itself -> must be rejected (403)
    ceiling_attempt = client.patch("/api/teams/seo/settings", headers=charlie_headers, json={
        "leader_ceiling_mb": 5000
    })
    assert ceiling_attempt.status_code == 403

def test_admin_moderation_message_delete():
    """Verify Main-Admin can delete any message for moderation."""
    charlie_token = get_token("charlie@company.internal", "Password@123")
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    # Charlie sends message in SEO
    msg_res = client.post("/api/messages", headers=charlie_headers, json={
        "team": "seo",
        "content": "Message with spam or improper content"
    })
    msg_id = msg_res.json()["id"]

    # Main-Admin deletes Charlie's message
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    del_res = client.delete(f"/api/messages/{msg_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert del_res.json()["deleted_by_admin"] is True

def test_message_reactions_and_pinning():
    """Verify toggling reactions and pins on messages."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Send message in team_ai
    msg_res = client.post("/api/messages", headers=headers, json={
        "team": "team_ai",
        "content": "Testing reactions and pins",
        "format": "markdown"
    })
    assert msg_res.status_code == 200
    msg_id = msg_res.json()["id"]

    # Toggle reaction 👍
    rx_res = client.post(f"/api/messages/{msg_id}/reactions", headers=headers, json={"emoji": "👍"})
    assert rx_res.status_code == 200
    assert "👍" in rx_res.json()["reactions"]

    # Toggle reaction again to remove
    rx_res2 = client.post(f"/api/messages/{msg_id}/reactions", headers=headers, json={"emoji": "👍"})
    assert rx_res2.status_code == 200
    assert "👍" not in rx_res2.json()["reactions"]

    # Pin message
    pin_res = client.post(f"/api/messages/{msg_id}/pin", headers=headers)
    assert pin_res.status_code == 200
    assert pin_res.json()["is_pinned"] is True

    # Check pinned messages query
    pinned_list = client.get("/api/messages/pinned?team=team_ai", headers=headers)
    assert pinned_list.status_code == 200
    assert any(m["id"] == msg_id for m in pinned_list.json())

def test_audit_logs_and_settings():
    """Verify audit logs and workspace settings endpoints."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Get settings
    s_res = client.get("/api/main-admin/settings", headers=headers)
    assert s_res.status_code == 200
    assert s_res.json()["workspace_name"] == "Cyber Sahayak"

    # Update settings
    up_res = client.put("/api/main-admin/settings", headers=headers, json={
        "workspace_name": "Cyber Sahayak Mesh",
        "sound_enabled": True
    })
    assert up_res.status_code == 200
    assert up_res.json()["workspace_name"] == "Cyber Sahayak Mesh"

    # Get audit logs
    logs_res = client.get("/api/main-admin/audit-logs", headers=headers)
    assert logs_res.status_code == 200
    assert isinstance(logs_res.json(), list)

def test_channel_announcements_and_updates_permissions():
    """Verify posting permissions on #announcements and #updates channels."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create self-contained regular employee and team leader
    client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Alice Employee",
        "email": "alice_emp@company.internal",
        "password": "Password@123",
        "team": "team_ai",
        "is_team_leader": False
    })
    alice_token = get_token("alice_emp@company.internal", "Password@123")
    alice_headers = {"Authorization": f"Bearer {alice_token}"}

    client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Charlie Leader",
        "email": "charlie_lead@company.internal",
        "password": "Password@123",
        "team": "seo",
        "is_team_leader": True
    })
    charlie_token = get_token("charlie_lead@company.internal", "Password@123")
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    # 1. Admin posts to #announcements -> 200 OK
    admin_announcement = client.post("/api/messages", headers=admin_headers, json={
        "content": "Official all-hands meeting at 4 PM",
        "format": "channel:announcements"
    })
    assert admin_announcement.status_code == 200
    assert admin_announcement.json()["format"] == "channel:announcements"

    # 2. Regular employee (Alice) tries to post to #announcements -> 403 Forbidden
    alice_announcement = client.post("/api/messages", headers=alice_headers, json={
        "content": "Employee unauthorized post",
        "format": "channel:announcements"
    })
    assert alice_announcement.status_code == 403

    # 3. Team leader (Charlie) posts to #updates -> 200 OK
    leader_update = client.post("/api/messages", headers=charlie_headers, json={
        "content": "SEO sprint milestone completed",
        "format": "channel:updates"
    })
    assert leader_update.status_code == 200
    assert leader_update.json()["format"] == "channel:updates"

    # 4. Regular employee (Alice) tries to post to #updates -> 403 Forbidden
    alice_update = client.post("/api/messages", headers=alice_headers, json={
        "content": "Alice unauthorized update",
        "format": "channel:updates"
    })
    assert alice_update.status_code == 403

    # 5. Anyone can read channel history
    history_res = client.get("/api/messages?format=channel:announcements", headers=alice_headers)
    assert history_res.status_code == 200
    assert any(m["content"] == "Official all-hands meeting at 4 PM" for m in history_res.json())

def test_chat_formatting_support():
    """Verify chat messages support bold, italic, strikethrough, and code markdown formatting."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    formatted_content = "Here is **bold text**, *italic text*, ~~strikethrough~~, and `inline code`."
    res = client.post("/api/messages", headers=headers, json={
        "team": "team_ai",
        "content": formatted_content,
        "format": "markdown"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["format"] == "markdown"
    assert "**bold text**" in data["content"]
    assert "*italic text*" in data["content"]
    assert "~~strikethrough~~" in data["content"]
    assert "`inline code`" in data["content"]

def test_global_search_messages_and_files():
    # Admin login
    res = client.post("/api/auth/login", json={
        "email": settings.INITIAL_ADMIN_EMAIL,
        "password": settings.INITIAL_ADMIN_PASSWORD
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Post a searchable message in announcements
    unique_term = "quantum_quantization_9988"
    client.post("/api/messages", headers=headers, json={
        "content": f"Critical AI update regarding {unique_term} optimization model",
        "format": "channel:announcements"
    })

    # Search for the unique term
    search_res = client.get(f"/api/messages/search?q={unique_term}", headers=headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "messages" in search_data
    assert "files" in search_data
    assert len(search_data["messages"]) >= 1
    assert unique_term in search_data["messages"][0]["content"]
    assert search_data["messages"][0]["chat_title"] == "announcements"

def test_message_idempotency_deduplication():
    """Verify rapid duplicate message requests within 2.5s return the same message rather than creating duplicates."""
    res = client.post("/api/auth/login", json={
        "email": settings.INITIAL_ADMIN_EMAIL,
        "password": settings.INITIAL_ADMIN_PASSWORD
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "team": "team_ai",
        "content": "Rapid idempotency test message from notification reply",
        "format": "plain"
    }

    # First send
    res1 = client.post("/api/messages", headers=headers, json=payload)
    assert res1.status_code == 200
    msg1 = res1.json()

    # Immediate second send (within 2.5s window)
    res2 = client.post("/api/messages", headers=headers, json=payload)
    assert res2.status_code == 200
    msg2 = res2.json()

    # Both must resolve to the identical message ID
    assert msg1["id"] == msg2["id"]

def test_attachment_view_team_scoping_and_headers():
    """Verify attachment viewing enforces team scoping via TeamMembership and adds CSP headers."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    alice_token = get_token("alice@company.internal", "Password@123")
    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    charlie_token = get_token("charlie@company.internal", "Password@123")
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    # 1. Alice (in team_legal) uploads an attachment to team_legal
    file_payload = {"file": ("team_spec.txt", b"Confidential Legal Document Content", "text/plain")}
    upload_res = client.post(
        "/api/attachments/upload",
        headers=alice_headers,
        files=file_payload,
        data={"team": "team_legal"}
    )
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    att_id = upload_res.json()["attachments"][0]["id"]

    # 2. Alice (member of team_legal) views the attachment -> 200 OK + security headers
    alice_view = client.get(f"/api/attachments/{att_id}/view", headers=alice_headers)
    assert alice_view.status_code == 200
    assert alice_view.headers.get("content-security-policy") == "sandbox"
    assert alice_view.headers.get("x-content-type-options") == "nosniff"

    # 3. Charlie (in seo, non-member of team_legal) tries to view -> 403 Forbidden (exercises TeamMembership check)
    charlie_view = client.get(f"/api/attachments/{att_id}/view", headers=charlie_headers)
    assert charlie_view.status_code == 403
    assert "Not authorized to access this team file" in charlie_view.json()["detail"]

    # 4. Main-Admin can view the attachment without restriction
    admin_view = client.get(f"/api/attachments/{att_id}/view", headers=admin_headers)
    assert admin_view.status_code == 200

def test_refresh_token_success_and_rotation():
    """Verify refresh token endpoint issues new access token, rotates refresh token, and blocks replay."""
    # 1. Login user
    login_res = client.post("/api/auth/login", json={
        "email": "alice@company.internal",
        "password": "Password@123"
    })
    assert login_res.status_code == 200
    data1 = login_res.json()
    assert "access_token" in data1
    assert "refresh_token" in data1
    old_refresh = data1["refresh_token"]

    # 2. Call /api/auth/refresh with valid refresh token
    refresh_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert refresh_res.status_code == 200
    data2 = refresh_res.json()
    assert "access_token" in data2
    assert "refresh_token" in data2
    new_refresh = data2["refresh_token"]
    assert new_refresh != old_refresh, "Refresh token must be rotated upon use"

    # 3. New access token works
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {data2['access_token']}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "alice@company.internal"

    # 4. Replaying old_refresh MUST be rejected (401 revoked)
    replay_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert replay_res.status_code == 401
    assert "revoked" in replay_res.json()["detail"].lower()

def test_refresh_token_expired_rejection():
    """Verify expired refresh tokens are rejected with 401."""
    db = TestingSessionLocal()
    alice = db.query(User).filter(User.email == "alice@company.internal").first()
    assert alice is not None

    raw_expired_token = generate_refresh_token()
    db_token = RefreshToken(
        user_id=alice.id,
        token_hash=hash_token(raw_expired_token),
        issued_at=datetime.utcnow() - timedelta(days=65),
        expires_at=datetime.utcnow() - timedelta(days=5),
        revoked_at=None
    )
    db.add(db_token)
    db.commit()
    db.close()

    res = client.post("/api/auth/refresh", json={"refresh_token": raw_expired_token})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()

def test_refresh_token_revoked_rejection():
    """Verify logging out revokes the refresh token and subsequent refresh calls fail."""
    # 1. Login Bob
    login_res = client.post("/api/auth/login", json={
        "email": "bob@company.internal",
        "password": "Password@123"
    })
    assert login_res.status_code == 200
    bob_refresh = login_res.json()["refresh_token"]

    # 2. Logout with refresh token
    logout_res = client.post("/api/auth/logout", json={"refresh_token": bob_refresh})
    assert logout_res.status_code == 200

    # 3. Attempting refresh with revoked token fails with 401
    refresh_res = client.post("/api/auth/refresh", json={"refresh_token": bob_refresh})
    assert refresh_res.status_code == 401
    assert "revoked" in refresh_res.json()["detail"].lower()

def test_forced_password_reset_revokes_prior_sessions():
    """Verify Main-Admin force-resetting a user password revokes all active refresh tokens for that user."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Charlie logs in and gets tokens
    charlie_login = client.post("/api/auth/login", json={
        "email": "charlie@company.internal",
        "password": "Password@123"
    })
    assert charlie_login.status_code == 200
    charlie_data = charlie_login.json()
    charlie_refresh = charlie_data["refresh_token"]
    charlie_id = charlie_data["user"]["id"]

    # 2. Main-Admin force-resets Charlie's password
    reset_res = client.patch(
        f"/api/main-admin/users/{charlie_id}/password",
        headers=admin_headers,
        json={"new_password": "NewSecretPassword@999"}
    )
    assert reset_res.status_code == 200

    # 3. Charlie's old refresh token MUST be revoked immediately
    fail_refresh = client.post("/api/auth/refresh", json={"refresh_token": charlie_refresh})
    assert fail_refresh.status_code == 401
    assert "revoked" in fail_refresh.json()["detail"].lower()

    # 4. Charlie can log in with new password
    new_login = client.post("/api/auth/login", json={
        "email": "charlie@company.internal",
        "password": "NewSecretPassword@999"
    })
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()
    assert "refresh_token" in new_login.json()

def test_message_destination_check_constraint():
    """Verify messages table check constraint enforces exactly one destination."""
    from sqlalchemy.exc import IntegrityError
    from app.models.reaction import MessageReaction
    from app.models.team_read import TeamReadReceipt

    db = TestingSessionLocal()
    try:
        admin = db.query(User).filter(User.is_main_admin == True).first()
        target = db.query(User).filter(User.email == "bob@company.internal").first()

        # 1. Both receiver_id and team set -> FAILS
        with pytest.raises(IntegrityError):
            bad_msg = Message(
                sender_id=admin.id,
                receiver_id=target.id,
                team=TeamEnum.team_ai,
                content="Illegal message with both",
                format="plain",
                created_at=datetime.utcnow()
            )
            db.add(bad_msg)
            db.commit()
        db.rollback()

        # 2. Neither receiver_id nor team nor channel format set -> FAILS
        with pytest.raises(IntegrityError):
            bad_msg = Message(
                sender_id=admin.id,
                receiver_id=None,
                team=None,
                content="Illegal message with neither",
                format="plain",
                created_at=datetime.utcnow()
            )
            db.add(bad_msg)
            db.commit()
        db.rollback()

        # 3. Both team set AND channel broadcast format -> FAILS
        with pytest.raises(IntegrityError):
            bad_msg = Message(
                sender_id=admin.id,
                receiver_id=None,
                team=TeamEnum.coordination,
                content="Illegal broadcast with team set",
                format="channel:announcements",
                created_at=datetime.utcnow()
            )
            db.add(bad_msg)
            db.commit()
        db.rollback()

        # 4. Valid broadcast channel message (team is None, receiver_id is None) -> SUCCEEDS
        good_broadcast = Message(
            sender_id=admin.id,
            receiver_id=None,
            team=None,
            content="Valid broadcast",
            format="channel:announcements",
            created_at=datetime.utcnow()
        )
        db.add(good_broadcast)
        db.commit()
        assert good_broadcast.id is not None

    finally:
        db.close()

def test_unique_constraints_on_reactions_and_team_read():
    """Verify unique constraints prevent duplicate reactions and duplicate team read receipts."""
    from sqlalchemy.exc import IntegrityError
    from app.models.reaction import MessageReaction
    from app.models.team_read import TeamReadReceipt

    db = TestingSessionLocal()
    try:
        admin = db.query(User).filter(User.is_main_admin == True).first()
        msg = db.query(Message).first()

        # 1. Duplicate Reaction
        r1 = MessageReaction(message_id=msg.id, user_id=admin.id, emoji="🔥", created_at=datetime.utcnow())
        db.add(r1)
        db.commit()

        with pytest.raises(IntegrityError):
            r2 = MessageReaction(message_id=msg.id, user_id=admin.id, emoji="🔥", created_at=datetime.utcnow())
            db.add(r2)
            db.commit()
        db.rollback()

        # 2. Duplicate TeamReadReceipt
        tr1 = TeamReadReceipt(user_id=admin.id, team=TeamEnum.team_ai, last_read_at=datetime.utcnow())
        db.add(tr1)
        db.commit()

        with pytest.raises(IntegrityError):
            tr2 = TeamReadReceipt(user_id=admin.id, team=TeamEnum.team_ai, last_read_at=datetime.utcnow())
            db.add(tr2)
            db.commit()
        db.rollback()

    finally:
        db.close()

def test_consolidated_message_service_logic():
    """Verify create_chat_message handles idempotency, channel normalization, and validation."""
    from app.services.message_service import create_chat_message, MessageValidationError

    db = TestingSessionLocal()
    try:
        admin = db.query(User).filter(User.is_main_admin == True).first()
        bob = db.query(User).filter(User.email == "bob@company.internal").first()
        if not bob:
            bob = User(
                email="bob@company.internal",
                name="Bob",
                password_hash="hash",
                status=UserStatus.active,
                team=TeamEnum.team_ai
            )
            db.add(bob)
            db.commit()

        # 1. Idempotency test: 2 sends within 2.5 seconds returns duplicate
        msg1, is_dup1 = create_chat_message(
            db=db,
            sender=admin,
            content="Idempotency unique test content 123",
            recipient_id=bob.id,
            format="plain"
        )
        assert is_dup1 is False

        msg2, is_dup2 = create_chat_message(
            db=db,
            sender=admin,
            content="Idempotency unique test content 123",
            recipient_id=bob.id,
            format="plain"
        )
        assert is_dup2 is True
        assert msg1.id == msg2.id

        # 2. Self DM validation
        with pytest.raises(MessageValidationError) as exc:
            create_chat_message(
                db=db,
                sender=admin,
                content="DM to self",
                recipient_id=admin.id
            )
        assert exc.value.status_code == 400

        # 3. Channel announcement normalization (team passed as string is normalized to None)
        announcement, is_dup_ann = create_chat_message(
            db=db,
            sender=admin,
            content="Global channel announcement via service",
            team="coordination",
            format="channel:announcements"
        )
        assert announcement.team is None
        assert announcement.receiver_id is None
        assert announcement.format == "channel:announcements"

        # 4. Cannot send message to a deleted recipient
        deleted_user = db.query(User).filter(User.status == UserStatus.deleted).first()
        if not deleted_user:
            deleted_user = User(
                email="test_deleted_recip@archived.internal",
                name="[Deleted User]",
                password_hash="hash",
                status=UserStatus.deleted
            )
            db.add(deleted_user)
            db.commit()

        with pytest.raises(MessageValidationError) as exc_info:
            create_chat_message(
                db=db,
                sender=admin,
                content="Hello to deleted user",
                recipient_id=deleted_user.id
            )
        assert exc_info.value.status_code == 400
        assert "deleted" in exc_info.value.detail.lower()

    finally:
        db.close()


def test_announcements_broadcast_rest_and_rbac():
    """
    Verify POST /api/messages for channel:announcements normalizes team to None,
    persists correctly, and enforces Main-Admin RBAC authorization.
    """
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    bob_token = get_token("bob@company.internal", "Password@123")
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # 1. Main-Admin sends announcement broadcast via REST
    res = client.post("/api/messages", headers=admin_headers, json={
        "content": "REST Announcement: company all-hands at 4 PM",
        "format": "channel:announcements",
        "team": "team_ai"  # even if mistakenly provided, must normalize to None
    })
    assert res.status_code == 200, f"Expected 200, got: {res.text}"
    msg_payload = res.json()
    assert msg_payload["format"] == "channel:announcements"
    assert msg_payload["team"] is None
    assert msg_payload["receiver_id"] is None

    # Verify message persisted in DB and obeys destination check constraint
    db = TestingSessionLocal()
    try:
        persisted = db.query(Message).filter(Message.id == msg_payload["id"]).first()
        assert persisted is not None
        assert persisted.team is None
        assert persisted.receiver_id is None
        assert persisted.format == "channel:announcements"
    finally:
        db.close()

    # 2. Regular employee attempts to send announcement via REST -> rejected with 403
    res_emp = client.post("/api/messages", headers=bob_headers, json={
        "content": "Unauthorized employee announcement",
        "format": "channel:announcements"
    })
    assert res_emp.status_code == 403
    assert "Only Main-Admin has authorization" in res_emp.json()["detail"]


def test_health_check_healthy_and_probe_cleanup():
    """Verify GET /health returns 200 with ok probes and cleans up the probe file."""
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["storage"] == "ok"
    probe_file = os.path.join(settings.UPLOAD_DIR, ".health_check_probe")
    assert not os.path.exists(probe_file), "Probe file must be cleaned up"


def test_health_check_unhealthy_on_db_failure(monkeypatch):
    """Verify GET /health returns 503 and unhealthy status if database query fails."""
    from app import main as app_main

    class BrokenSession:
        def execute(self, *args, **kwargs):
            raise RuntimeError("Database connection timed out or socket dropped")
        def close(self):
            pass

    monkeypatch.setattr(app_main, "SessionLocal", lambda: BrokenSession())
    res = client.get("/health")
    assert res.status_code == 503
    body = res.json()
    assert body["status"] == "unhealthy"
    assert "fail:" in body["checks"]["database"]
    assert body["checks"]["storage"] == "ok"


def test_startup_validation_short_secret_key_rejection():
    """Verify startup validation rejects SECRET_KEY < 32 chars without leaking the value."""
    from app.core.config import Settings
    with pytest.raises(Exception) as exc_info:
        Settings(
            SECRET_KEY="short-secret-key-123",  # < 32 chars
            DATABASE_URL="sqlite:///test.db",
            INITIAL_ADMIN_EMAIL="admin@company.internal",
            INITIAL_ADMIN_PASSWORD="Admin@123456"
        )
    err_str = str(exc_info.value)
    assert "SECRET_KEY: value is too short" in err_str
    # Crucial security guarantee: the actual secret value must not be leaked in the error
    assert "short-secret-key-123" not in err_str


def test_startup_validation_production_cors_lockdown():
    """Verify startup validation fails loudly if ENVIRONMENT=production uses default localhost origins."""
    from app.core.config import Settings
    with pytest.raises(Exception) as exc_info:
        Settings(
            SECRET_KEY="012345678901234567890123456789012",
            DATABASE_URL="sqlite:///test.db",
            INITIAL_ADMIN_EMAIL="admin@company.internal",
            INITIAL_ADMIN_PASSWORD="Admin@123456",
            ENVIRONMENT="production",
            ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
        )
    err_str = str(exc_info.value)
    assert "ALLOWED_ORIGINS: ENVIRONMENT=production requires explicit production domains" in err_str


# ==========================================
# PHASE 4: Admin User Management & Reset
# ==========================================

def test_admin_update_user_name_and_team_membership():
    """Verify Main-Admin can edit user name, team, and closes/opens TeamMembership."""
    from app.models.audit_log import AuditLog
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a user in team_ai
    create_res = client.post("/api/main-admin/users", headers=headers, json={
        "name": "Phase4 User",
        "email": "phase4.user@company.internal",
        "password": "Password@123",
        "team": "team_ai",
        "is_team_leader": False
    })
    assert create_res.status_code == 200
    user_id = create_res.json()["id"]

    # 2. Update user: change name to "Phase4 Renamed" and team to "team_legal"
    update_res = client.patch(f"/api/main-admin/users/{user_id}", headers=headers, json={
        "name": "Phase4 Renamed",
        "team": "team_legal"
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Phase4 Renamed"
    assert updated["team"] == "team_legal"

    # 3. Verify TeamMembership history in DB
    db = TestingSessionLocal()
    memberships = db.query(TeamMembership).filter(TeamMembership.user_id == user_id).order_by(TeamMembership.id.asc()).all()
    assert len(memberships) == 2
    # Old membership: team_ai should have left_at set
    assert memberships[0].team == TeamEnum.team_ai
    assert memberships[0].left_at is not None
    # New membership: team_legal should have joined_at set and left_at is None
    assert memberships[1].team == TeamEnum.team_legal
    assert memberships[1].joined_at is not None
    assert memberships[1].left_at is None

    # 4. Verify audit_log recorded the change
    audit = db.query(AuditLog).filter(
        AuditLog.action == "user:update",
        AuditLog.target == str(user_id)
    ).order_by(AuditLog.id.desc()).first()
    assert audit is not None
    assert "team_ai -> team_legal" in audit.details
    assert "name" in audit.details
    db.close()


def test_admin_update_user_rejects_forbidden_fields():
    """Verify PATCH /users/{user_id} rejects is_main_admin or password with 422."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Attempt to escalate privileges via is_main_admin
    res_admin = client.patch("/api/main-admin/users/1", headers=headers, json={
        "is_main_admin": True
    })
    assert res_admin.status_code == 422

    # Attempt to update password via PATCH /users/{id}
    res_pwd = client.patch("/api/main-admin/users/1", headers=headers, json={
        "password": "HackedPassword123!"
    })
    assert res_pwd.status_code == 422


def test_admin_update_user_team_leader_elevation_audit_logged():
    """Verify elevating a user to team leader is recorded in audit_logs."""
    from app.models.audit_log import AuditLog
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create user
    res = client.post("/api/main-admin/users", headers=headers, json={
        "name": "Leader Target",
        "email": "lead.target@company.internal",
        "password": "Password@123",
        "team": "seo",
        "is_team_leader": False
    })
    assert res.status_code == 200
    user_id = res.json()["id"]

    # Elevate to team leader
    patch_res = client.patch(f"/api/main-admin/users/{user_id}", headers=headers, json={
        "is_team_leader": True
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["is_team_leader"] is True

    # Check audit log
    db = TestingSessionLocal()
    audit = db.query(AuditLog).filter(
        AuditLog.action == "user:update",
        AuditLog.target == str(user_id)
    ).order_by(AuditLog.id.desc()).first()
    assert audit is not None
    assert "is_team_leader" in audit.details
    db.close()


def test_admin_reset_password_revokes_sessions():
    """Verify resetting user password revokes all active refresh tokens."""
    from app.models.audit_log import AuditLog
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a user
    res = client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Password Reset Target",
        "email": "pwd.target@company.internal",
        "password": "OldPassword@123",
        "team": "hr_admin"
    })
    assert res.status_code == 200
    user_id = res.json()["id"]

    # 2. Login as that user to generate a session / refresh token
    login_res = client.post("/api/auth/login", json={
        "email": "pwd.target@company.internal",
        "password": "OldPassword@123"
    })
    assert login_res.status_code == 200
    refresh_token = login_res.json().get("refresh_token")
    assert refresh_token is not None

    # 3. Admin resets password
    reset_res = client.patch(f"/api/main-admin/users/{user_id}/password", headers=admin_headers, json={
        "new_password": "BrandNewPassword@456"
    })
    assert reset_res.status_code == 200

    # 4. Verify old password fails, new password succeeds
    fail_res = client.post("/api/auth/login", json={
        "email": "pwd.target@company.internal",
        "password": "OldPassword@123"
    })
    assert fail_res.status_code == 401

    success_res = client.post("/api/auth/login", json={
        "email": "pwd.target@company.internal",
        "password": "BrandNewPassword@456"
    })
    assert success_res.status_code == 200

    # 5. Verify refresh token was revoked in database
    db = TestingSessionLocal()
    tokens = db.query(RefreshToken).filter(RefreshToken.user_id == user_id).all()
    assert len(tokens) > 0
    # The previous token must be revoked
    for tok in tokens:
        if tok.token_hash != hash_token(success_res.json().get("refresh_token", "")):
            assert tok.revoked_at is not None

    # 6. Verify audit log entry
    audit = db.query(AuditLog).filter(
        AuditLog.action == "user:reset_password",
        AuditLog.target == str(user_id)
    ).first()
    assert audit is not None
    db.close()


def test_non_admin_forbidden_from_admin_management_and_reset():
    """Verify regular employees receive 403 when calling admin endpoints."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    # Create employee
    res = client.post("/api/main-admin/users", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "name": "Standard Employee",
        "email": "standard.emp@company.internal",
        "password": "Password@123",
        "team": "team_ai"
    })
    assert res.status_code == 200
    emp_id = res.json()["id"]

    emp_token = get_token("standard.emp@company.internal", "Password@123")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Attempt to patch user
    patch_res = client.patch(f"/api/main-admin/users/{emp_id}", headers=emp_headers, json={"name": "Hacked"})
    assert patch_res.status_code == 403

    # Attempt to reset data
    reset_res = client.post("/api/main-admin/reset-data", headers=emp_headers)
    assert reset_res.status_code == 403


def test_admin_reset_workspace_data():
    """Verify POST /api/main-admin/reset-data cleans messages and writes audit log."""
    from app.models.audit_log import AuditLog
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Insert a dummy message
    db = TestingSessionLocal()
    test_msg = Message(
        sender_id=1,
        team=TeamEnum.coordination,
        content="Test message to be wiped"
    )
    db.add(test_msg)
    db.commit()
    db.close()

    # Call reset-data
    res = client.post("/api/main-admin/reset-data", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    # Verify messages are cleared
    db = TestingSessionLocal()
    msg_count = db.query(Message).count()
    assert msg_count == 0

    # Verify audit log
    audit = db.query(AuditLog).filter(AuditLog.action == "workspace:reset_seed").first()
    assert audit is not None
    db.close()
    audit = db.query(AuditLog).filter(AuditLog.action == "workspace:reset_seed").first()
    assert audit is not None

def test_employee_password_reset_without_admin_password():
    """Verify regular employee password reset does NOT require admin password."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create employee
    res = client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Employee Reset Tester",
        "email": "emp.reset@company.internal",
        "password": "InitialPassword@123",
        "team": "seo"
    })
    assert res.status_code == 200
    emp_id = res.json()["id"]

    # Reset employee password without providing current_admin_password
    reset_res = client.patch(f"/api/main-admin/users/{emp_id}/password", headers=admin_headers, json={
        "new_password": "UpdatedPassword@456"
    })
    assert reset_res.status_code == 200


def test_main_admin_password_reset_requires_current_admin_password():
    """Verify resetting a Main-Admin's password requires the current admin's password."""
    from app.models.audit_log import AuditLog
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    db = TestingSessionLocal()
    admin_user = db.query(User).filter(User.is_main_admin == True).first()
    admin_id = admin_user.id
    db.close()

    # 1. Reset without current_admin_password -> 403
    res_no_pwd = client.patch(f"/api/main-admin/users/{admin_id}/password", headers=admin_headers, json={
        "new_password": "NewSecretAdminPassword@123"
    })
    assert res_no_pwd.status_code == 403
    assert "Incorrect admin password" in res_no_pwd.json()["detail"]

    # 2. Reset with WRONG current_admin_password -> 403 and audit log
    res_wrong_pwd = client.patch(f"/api/main-admin/users/{admin_id}/password", headers=admin_headers, json={
        "new_password": "NewSecretAdminPassword@123",
        "current_admin_password": "TotallyWrongPassword"
    })
    assert res_wrong_pwd.status_code == 403
    assert "Incorrect admin password" in res_wrong_pwd.json()["detail"]

    db = TestingSessionLocal()
    audit_fail = db.query(AuditLog).filter(
        AuditLog.action == "admin:reset_admin_password_failed",
        AuditLog.target == str(admin_id)
    ).order_by(AuditLog.id.desc()).first()
    assert audit_fail is not None
    assert "Failed Main-Admin password reset attempt" in audit_fail.details
    db.close()

    # 3. Reset with CORRECT current_admin_password -> 200 & prior refresh tokens revoked
    res_correct = client.patch(f"/api/main-admin/users/{admin_id}/password", headers=admin_headers, json={
        "new_password": "NewSecretAdminPassword@123",
        "current_admin_password": settings.INITIAL_ADMIN_PASSWORD
    })
    assert res_correct.status_code == 200

    # 4. Old password fails login, new password succeeds
    fail_login = client.post("/api/auth/login", json={
        "email": settings.INITIAL_ADMIN_EMAIL,
        "password": settings.INITIAL_ADMIN_PASSWORD
    })
    assert fail_login.status_code == 401

    ok_login = client.post("/api/auth/login", json={
        "email": settings.INITIAL_ADMIN_EMAIL,
        "password": "NewSecretAdminPassword@123"
    })
    assert ok_login.status_code == 200

    # Restore initial admin password for subsequent tests
    new_admin_token = ok_login.json()["access_token"]
    restore_res = client.patch(f"/api/main-admin/users/{admin_id}/password", headers={"Authorization": f"Bearer {new_admin_token}"}, json={
        "new_password": settings.INITIAL_ADMIN_PASSWORD,
        "current_admin_password": "NewSecretAdminPassword@123"
    })
    assert restore_res.status_code == 200


def test_create_main_admin_with_step_up_auth():
    """Verify creating a Main-Admin requires step-up authentication and logs co_admin_created_by."""
    from app.models.audit_log import AuditLog
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Attempt creating Main-Admin with NO current_admin_password -> 403
    res_no_pass = client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Co-Admin No Pass",
        "email": "coadmin.nopass@company.internal",
        "password": "CeoPassword@123",
        "team": "coordination",
        "is_main_admin": True
    })
    assert res_no_pass.status_code == 403
    assert "Incorrect admin password" in res_no_pass.json()["detail"]

    # 2. Attempt creating Main-Admin with WRONG current_admin_password -> 403 + audit log
    res_wrong_pass = client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Co-Admin Wrong Pass",
        "email": "coadmin.wrong@company.internal",
        "password": "CeoPassword@123",
        "team": "coordination",
        "is_main_admin": True,
        "current_admin_password": "BogusPassword"
    })
    assert res_wrong_pass.status_code == 403

    db = TestingSessionLocal()
    fail_log = db.query(AuditLog).filter(
        AuditLog.action == "admin:create_admin_failed",
        AuditLog.target == "coadmin.wrong@company.internal"
    ).first()
    assert fail_log is not None
    assert "Failed Main-Admin provisioning attempt" in fail_log.details
    assert "BogusPassword" not in fail_log.details
    db.close()

    # 3. Create Main-Admin with CORRECT current_admin_password -> 200
    res_ok = client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Trusted Co-Admin",
        "email": "coadmin.trusted@company.internal",
        "password": "CeoPassword@123",
        "team": "coordination",
        "is_main_admin": True,
        "current_admin_password": settings.INITIAL_ADMIN_PASSWORD
    })
    assert res_ok.status_code == 200
    new_admin_data = res_ok.json()
    assert new_admin_data["is_main_admin"] is True
    new_admin_id = new_admin_data["id"]

    # Verify audit log co_admin_created_by
    db = TestingSessionLocal()
    success_log = db.query(AuditLog).filter(
        AuditLog.action == "admin:create_admin",
        AuditLog.target == str(new_admin_id)
    ).first()
    assert success_log is not None
    assert "co_admin_created_by" in success_log.details
    db.close()

    # Verify new co-admin can login and has admin privileges
    co_login = client.post("/api/auth/login", json={
        "email": "coadmin.trusted@company.internal",
        "password": "CeoPassword@123"
    })
    assert co_login.status_code == 200
    assert co_login.json()["user"]["is_main_admin"] is True


def test_list_main_admins_endpoint():
    """Verify GET /api/main-admin/admins lists all accounts with is_main_admin == True."""
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/main-admin/admins", headers=admin_headers)
    assert res.status_code == 200
    admins = res.json()
    assert isinstance(admins, list)
    assert len(admins) >= 2  # initial admin + trusted co-admin from previous test
    emails = [a["email"] for a in admins]
    assert settings.INITIAL_ADMIN_EMAIL in emails
    assert "coadmin.trusted@company.internal" in emails


def test_admin_delete_user_soft_archive():
    """Verify DELETE /api/main-admin/users/{id} deactivates user, revokes tokens, and records audit."""
    from app.models.audit_log import AuditLog
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a user to delete
    res = client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "Delete Me",
        "email": "delete.me@company.internal",
        "password": "Password@123",
        "team": "team_legal"
    })
    assert res.status_code == 200
    user_id = res.json()["id"]

    # 2. Login to get a token and session
    login_res = client.post("/api/auth/login", json={
        "email": "delete.me@company.internal",
        "password": "Password@123"
    })
    assert login_res.status_code == 200
    user_token = login_res.json()["access_token"]

    # 3. Delete user
    del_res = client.delete(f"/api/main-admin/users/{user_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # 4. Subsequent login fails with 403 / 401
    fail_login = client.post("/api/auth/login", json={
        "email": "delete.me@company.internal",
        "password": "Password@123"
    })
    assert fail_login.status_code in (401, 403)

    # 5. Deleted user's token rejected
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    assert me_res.status_code == 403

    # 6. Check database state
    db = TestingSessionLocal()
    user_in_db = db.query(User).filter(User.id == user_id).first()
    assert user_in_db.status.value == "deleted"
    assert user_in_db.name == "[Deleted User]"
    assert "delete.me@company.internal" not in user_in_db.email

    # Verify audit log
    audit = db.query(AuditLog).filter(
        AuditLog.action == "user:delete",
        AuditLog.target == str(user_id)
    ).first()
    assert audit is not None
    assert "deleted and archived user" in audit.details
    db.close()

    # 7. Admin cannot delete self
    db = TestingSessionLocal()
    admin_user = db.query(User).filter(User.is_main_admin == True).first()
    admin_id = admin_user.id
    db.close()
    self_del = client.delete(f"/api/main-admin/users/{admin_id}", headers=admin_headers)
    assert self_del.status_code == 400


# ==============================================================================
# PHASE 2 SECURITY REGRESSION TESTS
# ==============================================================================

def test_main_admin_and_foreign_employee_cannot_spy_on_private_dms():
    """
    Regression Test (Blocker 1):
    Verifies that GET /api/messages NEVER leaks private 1:1 employee DMs to:
    1. Main-Admin
    2. Other employees who are not party to the DM
    And ensures that DM participants CAN view their own messages.
    """
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Employee X and Employee Y
    client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "User X",
        "email": "user.x@company.internal",
        "password": "Password@123",
        "team": "team_ai"
    })
    client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "User Y",
        "email": "user.y@company.internal",
        "password": "Password@123",
        "team": "team_ai"
    })
    client.post("/api/main-admin/users", headers=admin_headers, json={
        "name": "User Z (Snooper)",
        "email": "user.z@company.internal",
        "password": "Password@123",
        "team": "team_legal"
    })

    x_token = get_token("user.x@company.internal", "Password@123")
    y_token = get_token("user.y@company.internal", "Password@123")
    z_token = get_token("user.z@company.internal", "Password@123")

    x_headers = {"Authorization": f"Bearer {x_token}"}
    y_headers = {"Authorization": f"Bearer {y_token}"}
    z_headers = {"Authorization": f"Bearer {z_token}"}

    y_id = client.get("/api/auth/me", headers=y_headers).json()["id"]

    # User X sends User Y a highly confidential private DM
    secret_text = "CLASSIFIED_SALARY_NEGOTIATION_XY_12345"
    send_res = client.post("/api/messages", headers=x_headers, json={
        "receiver_id": y_id,
        "content": secret_text
    })
    assert send_res.status_code == 200

    # 1. Main-Admin queries general message feed -> MUST NOT contain the secret DM
    admin_feed = client.get("/api/messages", headers=admin_headers)
    assert admin_feed.status_code == 200
    admin_messages = admin_feed.json()
    assert not any(secret_text in (m["content"] or "") for m in admin_messages), \
        "SECURITY VIOLATION: Main-Admin retrieved private employee 1:1 DM via GET /api/messages"

    # 2. Foreign Employee Z queries general message feed -> MUST NOT contain the secret DM
    z_feed = client.get("/api/messages", headers=z_headers)
    assert z_feed.status_code == 200
    z_messages = z_feed.json()
    assert not any(secret_text in (m["content"] or "") for m in z_messages), \
        "SECURITY VIOLATION: Foreign Employee Z retrieved private 1:1 DM between X and Y"

    # 3. Participant User X queries general feed -> CAN see their own DM
    x_feed = client.get("/api/messages", headers=x_headers)
    assert x_feed.status_code == 200
    assert any(secret_text in (m["content"] or "") for m in x_feed.json())

    # 4. Participant User Y queries general feed -> CAN see their own DM
    y_feed = client.get("/api/messages", headers=y_headers)
    assert y_feed.status_code == 200
    assert any(secret_text in (m["content"] or "") for m in y_feed.json())


def test_thread_idor_access_control():
    """
    Regression Test (Blocker 2):
    Verifies that GET /api/messages/{message_id}/thread enforces authorization:
    - 404 for foreign employees trying to view private DM threads.
    - 404 for Main-Admin trying to view private employee DM threads.
    - 200 for authorized participants.
    - 404 for employees trying to view foreign team threads.
    """
    x_token = get_token("user.x@company.internal", "Password@123")
    y_token = get_token("user.y@company.internal", "Password@123")
    z_token = get_token("user.z@company.internal", "Password@123")
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)

    x_headers = {"Authorization": f"Bearer {x_token}"}
    y_headers = {"Authorization": f"Bearer {y_token}"}
    z_headers = {"Authorization": f"Bearer {z_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    y_id = client.get("/api/auth/me", headers=y_headers).json()["id"]

    # 1. User X sends DM parent message
    parent_res = client.post("/api/messages", headers=x_headers, json={
        "receiver_id": y_id,
        "content": "Parent Private Message for Thread"
    })
    assert parent_res.status_code == 200
    parent_id = parent_res.json()["id"]

    # 2. User Y replies in thread
    reply_res = client.post("/api/messages", headers=y_headers, json={
        "receiver_id": client.get("/api/auth/me", headers=x_headers).json()["id"],
        "content": "Confidential Thread Reply",
        "reply_to_id": parent_id
    })
    assert reply_res.status_code == 200

    # 3. Foreign Employee Z attempts to read private thread -> 404
    z_thread = client.get(f"/api/messages/{parent_id}/thread", headers=z_headers)
    assert z_thread.status_code == 404, "SECURITY VIOLATION: Unauthorized user accessed private DM thread"

    # 4. Main-Admin attempts to read private thread -> 404
    admin_thread = client.get(f"/api/messages/{parent_id}/thread", headers=admin_headers)
    assert admin_thread.status_code == 404, "SECURITY VIOLATION: Main-Admin accessed private employee DM thread"

    # 5. Participant X reads thread -> 200 OK
    x_thread = client.get(f"/api/messages/{parent_id}/thread", headers=x_headers)
    assert x_thread.status_code == 200
    assert len(x_thread.json()) == 2

    # 6. Team Channel Thread authorization
    team_msg_res = client.post("/api/messages", headers=x_headers, json={
        "team": "team_ai",
        "content": "AI Team Thread Root"
    })
    assert team_msg_res.status_code == 200
    team_msg_id = team_msg_res.json()["id"]

    # User Z in team_legal attempts to read team_ai thread -> 404
    z_team_thread = client.get(f"/api/messages/{team_msg_id}/thread", headers=z_headers)
    assert z_team_thread.status_code == 404

    # Main-Admin reads team_ai thread -> 200 OK
    admin_team_thread = client.get(f"/api/messages/{team_msg_id}/thread", headers=admin_headers)
    assert admin_team_thread.status_code == 200


def test_pin_authorization_rules():
    """
    Regression Test (Blocker 3):
    Verifies that PATCH /api/messages/{message_id}/pin enforces strict authorization:
    - DM: only participants can pin (Foreign user & Main-Admin receive 404).
    - Team: active members & Main-Admin can pin; foreign members receive 404.
    - Announcements: Main-Admin only (employees receive 403).
    - Updates: Main-Admin and Team Leaders (regular employees receive 403).
    """
    admin_token = get_token(settings.INITIAL_ADMIN_EMAIL, settings.INITIAL_ADMIN_PASSWORD)
    x_token = get_token("user.x@company.internal", "Password@123")
    y_token = get_token("user.y@company.internal", "Password@123")
    z_token = get_token("user.z@company.internal", "Password@123")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    x_headers = {"Authorization": f"Bearer {x_token}"}
    y_headers = {"Authorization": f"Bearer {y_token}"}
    z_headers = {"Authorization": f"Bearer {z_token}"}

    y_id = client.get("/api/auth/me", headers=y_headers).json()["id"]

    # 1. Private DM pin test
    dm_res = client.post("/api/messages", headers=x_headers, json={
        "receiver_id": y_id,
        "content": "DM to Pin"
    })
    dm_id = dm_res.json()["id"]

    # Foreign Employee Z attempts to pin -> 404
    z_pin = client.patch(f"/api/messages/{dm_id}/pin", headers=z_headers, json={"is_pinned": True})
    assert z_pin.status_code == 404

    # Main-Admin attempts to pin foreign DM -> 404
    admin_pin = client.patch(f"/api/messages/{dm_id}/pin", headers=admin_headers, json={"is_pinned": True})
    assert admin_pin.status_code == 404

    # Participant X pins DM -> 200 OK
    x_pin = client.patch(f"/api/messages/{dm_id}/pin", headers=x_headers, json={"is_pinned": True})
    assert x_pin.status_code == 200
    assert x_pin.json()["is_pinned"] is True

    # 2. Announcement pin test
    ann_res = client.post("/api/messages", headers=admin_headers, json={
        "format": "channel:announcements",
        "content": "Official Announcement"
    })
    ann_id = ann_res.json()["id"]

    # Employee X attempts to pin announcement -> 403
    x_ann_pin = client.patch(f"/api/messages/{ann_id}/pin", headers=x_headers, json={"is_pinned": True})
    assert x_ann_pin.status_code == 403

    # Main-Admin pins announcement -> 200 OK
    admin_ann_pin = client.patch(f"/api/messages/{ann_id}/pin", headers=admin_headers, json={"is_pinned": True})
    assert admin_ann_pin.status_code == 200

    # 3. Updates pin test
    upd_res = client.post("/api/messages", headers=admin_headers, json={
        "format": "channel:updates",
        "content": "Company Update"
    })
    upd_id = upd_res.json()["id"]

    # Regular employee (User Y) attempts to pin update -> 403
    y_upd_pin = client.patch(f"/api/messages/{upd_id}/pin", headers=y_headers, json={"is_pinned": True})
    assert y_upd_pin.status_code == 403


def test_admin_password_immutability_on_reinitialization():
    """
    Regression Test (Blocker 4):
    Verifies that re-running init_db() on container reboot / application restart
    NEVER overwrites an existing Main-Admin password with INITIAL_ADMIN_PASSWORD.
    """
    from app.seed import init_db
    from app.core.security import verify_password

    db = TestingSessionLocal()
    admin = db.query(User).filter(User.is_main_admin == True).first()
    assert admin is not None
    original_email = admin.email

    # 1. Admin updates password to a custom new password
    from app.core.security import get_password_hash
    custom_password = "CustomSuperSecretAdminPassword!2026"
    admin.password_hash = get_password_hash(custom_password)
    db.commit()
    db.close()

    # 2. Simulate application reboot / container restart by executing init_db()
    init_db()

    # 3. Verify that the custom password is still active and was NOT overwritten
    db2 = TestingSessionLocal()
    admin_recheck = db2.query(User).filter(User.email == original_email).first()
    assert verify_password(custom_password, admin_recheck.password_hash) is True, \
        "SECURITY FLAW: init_db() overwritten custom administrator password!"
    assert verify_password(settings.INITIAL_ADMIN_PASSWORD, admin_recheck.password_hash) is False
    db2.close()


def test_cleanup_attachments_utility(tmp_path):
    """
    Regression Test (Blocker 7):
    Verifies cleanup_attachments.py:
    1. Dry-run by default performs ZERO deletions.
    2. --execute deletes orphan files and expired soft-deleted attachments.
    3. Active non-deleted attachments are preserved.
    4. Path traversal attempts are rejected.
    """
    from cleanup_attachments import run_cleanup, is_safe_subpath

    upload_test_dir = str(tmp_path / "test_uploads")
    os.makedirs(upload_test_dir, exist_ok=True)

    db = TestingSessionLocal()

    # 1. Create an active valid attachment
    active_msg = Message(
        sender_id=1,
        team=TeamEnum.team_ai,
        content="Active message with attachment",
        created_at=datetime.utcnow()
    )
    db.add(active_msg)
    db.commit()

    active_file = os.path.join(upload_test_dir, "active_doc.pdf")
    with open(active_file, "w") as f:
        f.write("active content")

    active_att = Attachment(
        message_id=active_msg.id,
        file_name="active_doc.pdf",
        file_path=active_file,
        file_size_bytes=14,
        mime_type="application/pdf"
    )
    db.add(active_att)

    # 2. Create an expired soft-deleted attachment (deleted 100 days ago)
    deleted_msg = Message(
        sender_id=1,
        team=TeamEnum.team_ai,
        content="Deleted message with old attachment",
        created_at=datetime.utcnow() - timedelta(days=120),
        deleted_at=datetime.utcnow() - timedelta(days=100)
    )
    db.add(deleted_msg)
    db.commit()

    expired_file = os.path.join(upload_test_dir, "expired_doc.pdf")
    with open(expired_file, "w") as f:
        f.write("expired content")

    expired_att = Attachment(
        message_id=deleted_msg.id,
        file_name="expired_doc.pdf",
        file_path=expired_file,
        file_size_bytes=15,
        mime_type="application/pdf"
    )
    db.add(expired_att)
    db.commit()

    # 3. Create an orphan file on disk (no DB record)
    orphan_file = os.path.join(upload_test_dir, "orphan_temp_file.tmp")
    with open(orphan_file, "w") as f:
        f.write("orphan temp file")

    # Step A: Dry-Run execution -> Must find orphans & expired, but delete ZERO files
    dry_run_res = run_cleanup(
        dry_run=True,
        retention_days=90,
        upload_dir=upload_test_dir,
        db_session=db
    )
    assert dry_run_res["orphans_found"] >= 1
    assert dry_run_res["expired_found"] >= 1
    assert dry_run_res["orphans_deleted"] == 0
    assert dry_run_res["expired_deleted"] == 0
    assert os.path.exists(orphan_file) is True
    assert os.path.exists(expired_file) is True
    assert os.path.exists(active_file) is True

    # Step B: Execute mode -> Deletes orphan and expired file, preserves active file
    exec_res = run_cleanup(
        dry_run=False,
        retention_days=90,
        upload_dir=upload_test_dir,
        db_session=db
    )
    assert exec_res["orphans_deleted"] >= 1
    assert exec_res["expired_deleted"] >= 1
    assert os.path.exists(orphan_file) is False
    assert os.path.exists(expired_file) is False
    assert os.path.exists(active_file) is True, "CRITICAL: Active attachment was incorrectly deleted!"
    db.close()

    # Step C: Path Traversal rejection check
    assert is_safe_subpath("/etc/passwd", upload_test_dir) is False
    assert is_safe_subpath(upload_test_dir + "/../../secret.key", upload_test_dir) is False
    assert is_safe_subpath(os.path.join(upload_test_dir, "safe_file.txt"), upload_test_dir) is True








