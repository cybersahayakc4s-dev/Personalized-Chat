from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.config import settings
from ..core.security import verify_password, create_access_token, hash_token, generate_refresh_token
from ..core.limiter import limiter
from ..models.user import User, UserStatus
from ..models.refresh_token import RefreshToken
from ..schemas.user import LoginRequest, TokenResponse, UserOut, RefreshRequest, LogoutRequest
from .deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email.lower().strip()).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if user.status != UserStatus.active:
        detail_msg = "Account is deleted" if user.status == UserStatus.deleted else "Account is disabled. Contact Main-Admin."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail_msg
        )
    
    access_token = create_access_token(data={"sub": str(user.id), "is_main_admin": user.is_main_admin})
    raw_refresh_token = generate_refresh_token()
    token_hash = hash_token(raw_refresh_token)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db_refresh = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        issued_at=datetime.utcnow()
    )
    db.add(db_refresh)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    refresh_in: RefreshRequest,
    db: Session = Depends(get_db)
):
    raw_token = refresh_in.refresh_token.strip()
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is required"
        )

    t_hash = hash_token(raw_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == t_hash).first()

    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    if db_token.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked"
        )

    if db_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired"
        )

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user or user.status != UserStatus.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled or no longer exists"
        )

    # Rotate refresh token: revoke old token and issue new pair
    now = datetime.utcnow()
    db_token.revoked_at = now

    new_raw_refresh = generate_refresh_token()
    new_token_hash = hash_token(new_raw_refresh)
    new_expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    new_db_token = RefreshToken(
        user_id=user.id,
        token_hash=new_token_hash,
        expires_at=new_expires_at,
        issued_at=now
    )
    db.add(new_db_token)
    db.commit()

    new_access_token = create_access_token(data={"sub": str(user.id), "is_main_admin": user.is_main_admin})

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_raw_refresh,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )

@router.post("/logout")
def logout(
    logout_in: LogoutRequest,
    db: Session = Depends(get_db)
):
    if logout_in.refresh_token:
        raw_token = logout_in.refresh_token.strip()
        if raw_token:
            t_hash = hash_token(raw_token)
            db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == t_hash).first()
            if db_token and db_token.revoked_at is None:
                db_token.revoked_at = datetime.utcnow()
                db.commit()

    return {"status": "ok", "message": "Successfully logged out"}

@router.post("/register")
def register():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Public account registration is disabled. All accounts must be provisioned exclusively by Main-Admin within the workspace."
    )

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
