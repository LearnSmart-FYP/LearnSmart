from fastapi import Depends, HTTPException, status, Request
from jose import jwt, JWTError
from uuid import UUID
from app.core.config import settings
from app.core.database import get_postgres
from app.repositories import UserRepository

async def get_current_user(
    request: Request,
    db = Depends(get_postgres)):

    credentials_exception = HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail = "Invalid or expired token",
        headers = {"WWW-Authenticate": "Bearer"})

    # Accept HttpOnly cookie or Authorization: Bearer header (for mobile clients)
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise credentials_exception

    try:

        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm])
        user_id_str = payload.get("sub")

        if user_id_str is None:
            raise credentials_exception
        
        user_id = UUID(user_id_str)

    except (JWTError, ValueError):
        raise credentials_exception

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)

    if user is None:
        raise credentials_exception
    
    if not user["is_active"]:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Account is deactivated")

    return user

async def require_admin(current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Admin access required")
    return current_user

async def require_teacher(current_user = Depends(get_current_user)):
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Teacher access required")
    return current_user

async def require_verified_email(current_user = Depends(get_current_user)):
    if not current_user["email_verified"]:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Email verification required")
    return current_user
