from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import Field, SQLModel


class Analysis(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

    resume_filename: str
    resume_text: str
    job_description: str

    match_score: Optional[int] = Field(default=None, index=True)
    result: dict[str, Any] = Field(sa_column=Column(JSON), default_factory=dict)

