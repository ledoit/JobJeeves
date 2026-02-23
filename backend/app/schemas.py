from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class AnalyzeResponse(BaseModel):
    analysis_id: UUID
    match_score: int = Field(ge=0, le=100)
    missing_keywords: list[str]
    improvement_suggestions: list[str]
    strengths: list[str] = Field(default_factory=list)
    short_summary: str = ""
    raw: dict[str, Any] = Field(default_factory=dict)

