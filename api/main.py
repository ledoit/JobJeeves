from typing import Optional
from uuid import UUID

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError
from sqlmodel import Session, select

from db import create_db_and_tables, get_session
from models import Analysis
from openai_analyzer import analyze_resume_vs_job
from pdf import extract_text_from_pdf
from schemas import AnalyzeResponse
from settings import settings


app = FastAPI(title="JobJeeves API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    job_description: str = Form(""),
    analysis_source: str = Form("auto"),
    resume_text: str = Form(""),
    file: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
):
    resume_filename = "resume.txt"
    normalized_resume_text = resume_text.strip()

    if file is not None and file.filename:
        if file.content_type not in ("application/pdf", "application/x-pdf", "application/octet-stream"):
            raise HTTPException(status_code=400, detail="Please upload a PDF.")
        pdf_bytes = await file.read()
        extracted = extract_text_from_pdf(pdf_bytes)
        if not extracted:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF (is it scanned/image-only?).")
        normalized_resume_text = extracted
        resume_filename = file.filename or "resume.pdf"
    elif not normalized_resume_text:
        raise HTTPException(status_code=400, detail="Provide a resume PDF upload or pasted resume text.")

    try:
        normalized_job_description = job_description.strip()
        result = analyze_resume_vs_job(
            resume_text=normalized_resume_text,
            job_description=normalized_job_description,
            analysis_source=analysis_source,
        )
    except RuntimeError as e:
        # Configuration problems (missing API keys, etc.)
        raise HTTPException(status_code=400, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=f"LLM authentication failed: {e}")
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=f"LLM rate limit / quota exceeded: {e}")
    except APIConnectionError as e:
        raise HTTPException(status_code=502, detail=f"LLM connection failed: {e}")
    except APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"LLM upstream error ({e.status_code}): {e.message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM analysis failed: {e}")

    analysis = Analysis(
        resume_filename=resume_filename,
        resume_text=normalized_resume_text,
        job_description=job_description,
        match_score=int(result.get("match_score", 0)),
        result=result,
    )
    session.add(analysis)
    session.commit()
    session.refresh(analysis)

    return AnalyzeResponse(
        analysis_id=analysis.id,
        match_score=analysis.match_score or 0,
        analysis_mode=str(result.get("analysis_mode") or ("resume_only" if not normalized_job_description else "job_match")),
        analysis_engine=str(result.get("analysis_engine") or settings.llm_provider or "groq"),
        missing_keywords=list(result.get("missing_keywords") or []),
        improvement_suggestions=list(result.get("improvement_suggestions") or []),
        strengths=list(result.get("strengths") or []),
        short_summary=str(result.get("short_summary") or ""),
        resume_text=normalized_resume_text,
        tailored_resume=str(result.get("tailored_resume") or ""),
        raw=result,
    )


@app.get("/api/analyses/{analysis_id}")
def get_analysis(analysis_id: str, session: Session = Depends(get_session)):
    try:
        analysis_uuid = UUID(analysis_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid analysis_id")

    stmt = select(Analysis).where(Analysis.id == analysis_uuid)
    analysis = session.exec(stmt).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Not found")
    return analysis

