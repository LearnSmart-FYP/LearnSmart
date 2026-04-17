from typing import Any

from fastapi import APIRouter, Depends

from app.core.database import get_postgres
from app.repositories.game.subject_repository import SubjectRepository


router = APIRouter(prefix="/subjects", tags=["Subjects"])


@router.get("")
async def list_subjects(db = Depends(get_postgres)) -> list[dict[str, Any]]:
    """List subjects for quick select.

    Returns a minimal shape: [{ id, code, name }].
    """
    repo = SubjectRepository(db)
    return await repo.list_subjects()
