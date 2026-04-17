from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.dependencies import get_current_user, get_postgres
from app.services.planWorkflow_service import PlanWorkflowService

# Define the router
timer_router = APIRouter()

# Define the TaskDTO model
class TaskDTO(BaseModel):
    id: str
    title: str
    type: str
    status: str
    duration_minutes: int
    remaining_minutes: Optional[int] = None
    userId: Optional[str] = None
    projectId: Optional[str] = None
    createdBy: Optional[str] = None
    updatedBy: Optional[str] = None
    scriptId: Optional[str] = None
    knowledgeId: Optional[str] = None
    tags: List[str]
    createdAt: str
    updatedAt: str

# Mock data for tasks (fallback)
mock_tasks = [
    {
        "id": "1",
        "title": "Memory Training",
        "type": "memory",
        "status": "in-progress",
        "duration_minutes": 30,
        "remaining_minutes": 25,
        "userId": "00000000-0000-0000-0000-000000000003",
        "projectId": "project-1",
        "createdBy": "user-1",
        "updatedBy": "user-1",
        "tags": ["memory", "review"],
        "createdAt": "2026-03-25T12:00:00Z",
        "updatedAt": "2026-03-26T08:00:00Z"
    },
    {
        "id": "2",
        "title": "Logic Reasoning",
        "type": "logic",
        "status": "pending",
        "duration_minutes": 25,
        "remaining_minutes": 25,
        "userId": "00000000-0000-0000-0000-000000000003",
        "projectId": "project-2",
        "createdBy": "user-1",
        "updatedBy": "user-1",
        "tags": ["logic", "puzzle"],
        "createdAt": "2026-03-25T13:00:00Z",
        "updatedAt": "2026-03-25T13:30:00Z"
    },
    {
        "id": "3",
        "title": "Script Interpretation (Murder Mystery)",
        "type": "script",
        "status": "pending",
        "duration_minutes": 20,
        "remaining_minutes": 20,
        "userId": "00000000-0000-0000-0000-000000000003",
        "projectId": "project-3",
        "createdBy": "user-2",
        "updatedBy": "user-2",
        "tags": ["script", "murder-mystery"],
        "createdAt": "2026-03-26T09:00:00Z",
        "updatedAt": "2026-03-26T09:05:00Z"
    },
    {
        "id": "4",
        "title": "Storyline Reconstruction (Murder Mystery Debrief)",
        "type": "understanding",
        "status": "pending",
        "duration_minutes": 15,
        "remaining_minutes": 15,
        "userId": "00000000-0000-0000-0000-000000000003",
        "projectId": "project-3",
        "createdBy": "user-2",
        "updatedBy": "user-2",
        "tags": ["understanding", "review"],
        "createdAt": "2026-03-26T09:30:00Z",
        "updatedAt": "2026-03-26T09:35:00Z"
    }
]

# Define the endpoint
@timer_router.get("/api/timer/tasks", response_model=List[TaskDTO])
async def get_tasks(
    current_user=Depends(get_current_user),
    db=Depends(get_postgres)
):
    """
    Get today's tasks for the timer.
    Returns tasks from daily plan, ready for the timer to consume.
    """
    try:
        user_id = str(current_user["id"])
        service = PlanWorkflowService(db)
        
        # Get daily tasks from the service
        tasks = await service.get_daily_tasks(user_id, None)
        
        # Convert DailyPlanTaskDTO to TaskDTO format
        result = []
        for task in tasks:
            # Handle both dict and DailyPlanTaskDTO objects
            task_dict = task.model_dump() if hasattr(task, 'model_dump') else (task.dict() if hasattr(task, 'dict') else task)
            
            result.append(TaskDTO(
                id=task_dict.get("id", ""),
                title=task_dict.get("title", ""),
                type=task_dict.get("type", "memory"),
                status=task_dict.get("status", "pending"),
                duration_minutes=task_dict.get("durationMinutes", 25),
                remaining_minutes=None,  # Will be set by frontend based on timer state
                userId=task_dict.get("userId"),
                projectId=None,  # Not in DailyPlanTaskDTO
                createdBy=None,  # Not in DailyPlanTaskDTO
                updatedBy=None,  # Not in DailyPlanTaskDTO
                scriptId=task_dict.get("scriptId", None),
                knowledgeId=task_dict.get("knowledgeId", None),
                tags=task_dict.get("tags", []),
                createdAt=str(task_dict.get("createdAt", datetime.utcnow().isoformat())) + ("Z" if not str(task_dict.get("createdAt", "")).endswith("Z") else ""),
                updatedAt=str(task_dict.get("createdAt", datetime.utcnow().isoformat())) + ("Z" if not str(task_dict.get("createdAt", "")).endswith("Z") else ""),
            ))
        
        return result
    except Exception as e:
        print(f"Error getting timer tasks: {e}")
        import traceback
        traceback.print_exc()
        return []