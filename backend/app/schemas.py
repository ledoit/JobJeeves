from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class AnalyzeResponse(BaseModel):
    analysis_id: UUID
    match_score: int = Field(ge=0, le=100)
    analysis_mode: str = "job_match"
    analysis_engine: str = "groq"
    missing_keywords: list[str]
    improvement_suggestions: list[str]
    strengths: list[str] = Field(default_factory=list)
    short_summary: str = ""
    resume_text: str = ""
    raw: dict[str, Any] = Field(default_factory=dict)

