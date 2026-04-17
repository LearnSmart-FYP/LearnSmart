"""
Lightweight helper to log real learning activities.
Usage:
    await log_activity(db, user_id, "flashcard", sub_type="review", resource_id=card_id)
    await log_activity(db, user_id, "error_review", sub_type="complete", details={"count": 3})
"""
import logging
from uuid import UUID
from typing import Optional

logger = logging.getLogger(__name__)

# Full mapping of every valid (activity_type → sub_types).
# Marked with ★ = counts as meaningful learning for streak.
VALID_SUB_TYPES: dict[str, set[str]] = {
    "flashcard":    {"review", "create", "modify", "share", "obtain", "delete", "view"},
    "error_review": {"review", "complete", "add", "view"},
    "assignment":   {"submit", "start", "view"},
    "quiz":         {"attempt", "complete", "view"},
    "document":     {"upload", "view", "delete"},
    "feynman":      {"create", "practice", "view"},
    "challenge":    {"attempt", "complete", "join", "view"},
    "mentorship":   {"session", "request"},
    "study_plan":   {"complete", "create", "view"},
}

# Which sub_types count as real learning for streak (subset of VALID_SUB_TYPES).
MEANINGFUL_SUB_TYPES: dict[str, set[str]] = {
    "flashcard":    {"review", "create"},
    "error_review": {"review", "complete"},
    "assignment":   {"submit"},
    "quiz":         {"attempt", "complete"},
    "document":     {"upload"},
    "feynman":      {"create", "practice"},
    "challenge":    {"attempt", "complete"},
    "mentorship":   {"session"},
    "study_plan":   {"complete"},
}


def is_meaningful(activity_type: str, sub_type: Optional[str] = None) -> bool:
    """Check if an activity counts as meaningful learning for streak."""
    allowed = MEANINGFUL_SUB_TYPES.get(activity_type)
    if allowed is None:
        # Unknown activity type — not meaningful
        return False
    if sub_type is None:
        # No sub_type given — meaningful only if the set allows None (it doesn't here)
        return False
    return sub_type in allowed


async def log_activity(
    db,
    user_id: UUID,
    activity_type: str,
    sub_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    details: Optional[dict] = None,
) -> None:
    """Insert a row into learning_activity_log. Fire-and-forget safe."""
    try:
        import json
        await db.execute(
            """
            INSERT INTO learning_activity_log (user_id, activity_type, sub_type, resource_id, details)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            """,
            user_id,
            activity_type,
            sub_type,
            resource_id,
            json.dumps(details) if details else None,
        )
    except Exception as e:
        logger.warning(f"Failed to log activity: {e}")
