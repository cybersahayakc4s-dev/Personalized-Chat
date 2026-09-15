from typing import Optional
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import decode_access_token
from ..models.user import User, UserStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(
    header_token: Optional[str] = Depends(oauth2_scheme),
    query_token: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db)
) -> User:
    token = header_token or query_token
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    if str(user_id).isdigit():
        user = db.query(User).filter(User.id == int(user_id)).first()
    else:
        user = db.query(User).filter(User.email == str(user_id).lower().strip()).first()
    if user is None:
        raise credentials_exception
    if user.status != UserStatus.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    return user

def get_current_main_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_main_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action requires Main-Admin privileges"
        )
    return current_user
