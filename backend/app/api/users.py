from fastapi import APIRouter, Depends, HTTPException, status
from app.core.database import get_postgres
from app.core.dependencies import get_current_user, require_admin, require_teacher
from app.repositories import UserRepository, SessionRepository
from app.models.user import UserResponse, UserUpdate, UserProfileResponse, PasswordChange, UserSessionResponse
from app.services import AuthService
from uuid import UUID

router = APIRouter(prefix = "/users", tags = ["Users"])


async def _audit(db, actor, action_type: str, resource_type: str, resource_id: str):
    await db.execute(
        """
        INSERT INTO admin_audit_log
          (actor_id, actor_email, action_type, module, resource_type, resource_id)
        VALUES ($1, $2, $3, $4, $5, $6::uuid)
        """,
        actor["id"], actor.get("email"), action_type, "user_management", resource_type, resource_id,
    )

@router.get("/me", response_model = UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    return dict(current_user)

@router.patch("/me", response_model = UserResponse)
async def update_me(
    data: UserUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = UserRepository(db)
    update_fields = data.model_dump(exclude_unset = True)

    if not update_fields:
        return dict(current_user)

    user = await repo.update(current_user["id"], **update_fields)
    return dict(user)

@router.post("/me/change-password")
async def change_password(
    data: PasswordChange,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    if not current_user["password_hash"]:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Cannot change password for OAuth-only accounts")

    if not AuthService.verify_password(data.current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Current password is incorrect")

    repo = UserRepository(db)
    new_hash = AuthService.hash_password(data.new_password)
    await repo.update_password(current_user["id"], new_hash)

    return {"message": "Password changed successfully"}

@router.get("/me/profile", response_model = UserProfileResponse)
async def get_my_profile(
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = UserRepository(db)
    profile = await repo.get_profile(current_user["id"])

    if profile is None:
        profile = await repo.create_profile(current_user["id"])

    return dict(profile)

@router.patch("/me/profile", response_model = UserProfileResponse)
async def update_my_profile(
    bio: str | None = None,
    avatar_url: str | None = None,
    organization: str | None = None,
    department: str | None = None,
    level: str | None = None,
    timezone: str | None = None,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):

    repo = UserRepository(db)

    update_fields = {}
    if bio is not None:
        update_fields["bio"] = bio
    if avatar_url is not None:
        update_fields["avatar_url"] = avatar_url
    if organization is not None:
        update_fields["organization"] = organization
    if department is not None:
        update_fields["department"] = department
    if level is not None:
        update_fields["level"] = level
    if timezone is not None:
        update_fields["timezone"] = timezone

    profile = await repo.get_profile(current_user["id"])

    if profile is None:
        profile = await repo.create_profile(current_user["id"], **update_fields)
    else:
        profile = await repo.update_profile(current_user["id"], **update_fields)

    return dict(profile)

@router.get("/me/sessions", response_model = list[UserSessionResponse])
async def get_my_sessions(
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):
    """
    Get all active sessions for the current user.
    Returns session details including IP address, user agent, and activity timestamps.
    """
    repo = SessionRepository(db)
    sessions = await repo.get_user_sessions(current_user["id"])
    return [dict(s) for s in sessions]

@router.delete("/me/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):
    """
    Delete a specific session (log out from a specific device).
    Users can only delete their own sessions.
    """
    try:
        sid = UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid session ID format")

    repo = SessionRepository(db)

    # Verify the session belongs to the current user
    session = await repo.get_by_id(sid)
    if session is None:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Session not found or already expired")

    if session["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Cannot delete another user's session")

    success = await repo.delete(sid)

    if not success:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Session not found")

    return {"message": "Session deleted successfully"}

@router.get("/search")
async def search_users(
    q: str = "",
    current_user = Depends(get_current_user),
    db = Depends(get_postgres)):
    """Search users by email or username. Returns id, username, email, display_name."""
    if not q or len(q) < 2:
        return {"users": []}
    rows = await db.fetch(
        """
        SELECT id, username, email, display_name
        FROM users
        WHERE (LOWER(username) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1))
          AND id != $2 AND is_active = TRUE
        ORDER BY username ASC
        LIMIT 10
        """,
        f"%{q}%", current_user["id"],
    )
    return {"users": [dict(r) for r in rows]}

@router.get("", response_model = list[UserResponse])
async def list_users(
    limit: int = 100,
    offset: int = 0,
    role: str | None = None,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    repo = UserRepository(db)

    if role:
        users = await repo.get_by_role(role, limit)
    else:
        users = await repo.get_all(limit, offset)

    return [dict(u) for u in users]

@router.get("/{user_id}", response_model = UserResponse)
async def get_user(
    user_id: str,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid user ID format")

    repo = UserRepository(db)
    user = await repo.get_by_id(uid)

    if user is None:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    return dict(user)

@router.delete("/{user_id}")
async def deactivate_user(
    user_id: str,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid user ID format")

    if uid == current_user["id"]:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Cannot deactivate your own account")

    repo = UserRepository(db)
    success = await repo.deactivate(uid)

    if not success:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    await _audit(db, current_user, "deactivate_user", "user", user_id)
    return {"message": "User deactivated successfully"}

@router.post("/{user_id}/activate")
async def activate_user(
    user_id: str,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid user ID format")

    repo = UserRepository(db)
    success = await repo.activate(uid)

    if not success:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    await _audit(db, current_user, "activate_user", "user", user_id)
    return {"message": "User activated successfully"}

@router.patch("/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    current_user = Depends(require_admin),
    db = Depends(get_postgres)):

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Invalid user ID format")

    if uid == current_user["id"]:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "Cannot change your own role")

    valid_roles = ["student", "teacher", "admin"]
    if role not in valid_roles:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = f"Invalid role. Must be one of: {', '.join(valid_roles)}")

    repo = UserRepository(db)
    user = await repo.update(uid, role=role)

    if not user:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User not found")

    return {"message": "User role updated successfully"}
