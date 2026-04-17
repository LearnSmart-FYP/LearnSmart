from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class ProcedureStepResponse(BaseModel):
    index: int
    action: str
    detail: str | None = None
    expected_result: str | None = None
    references_concepts: list[UUID] | None = None
    uses_assets: list[UUID] | None = None

class ProcedureResponse(BaseModel):
    concept_id: UUID
    procedure_id: UUID
    concept_title: str
    concept_description: str | None
    difficulty_level: str | None
    expected_duration_minutes: int | None
    stored_in_neo4j: bool
    purpose: str | None
    language: str

    class Config:
        from_attributes = True

class ProcedureDetailResponse(BaseModel):
    concept_id: UUID
    procedure_id: UUID
    concept_title: str
    concept_description: str | None
    difficulty_level: str | None
    expected_duration_minutes: int | None
    stored_in_neo4j: bool
    purpose: str | None
    preconditions: list[dict] | None = None  # [{item, description}]
    failure_modes: list[dict] | None = None  # [{mode, symptoms, fix}]
    verification_checks: list[dict] | None = None  # [{check, expected_result}]
    steps: list[dict] | None = None  # [{index, action, detail, expected_result, ...}]
    language: str
    created_at: datetime

    class Config:
        from_attributes = True

class ProcedureListResponse(BaseModel):
    total: int
    procedures: list[ProcedureResponse]
