from uuid import UUID

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError
from sqlmodel import Session, select

from app.db import create_db_and_tables, get_session
from app.models import Analysis
from app.openai_analyzer import analyze_resume_vs_job
from app.pdf import extract_text_from_pdf
from app.schemas import AnalyzeResponse
from app.settings import settings


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
    job_description: str = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    if file.content_type not in ("application/pdf", "application/x-pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Please upload a PDF.")

    pdf_bytes = await file.read()
    resume_text = extract_text_from_pdf(pdf_bytes)
    if not resume_text:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF (is it scanned/image-only?).")

    try:
        result = analyze_resume_vs_job(resume_text=resume_text, job_description=job_description)
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
        resume_filename=file.filename or "resume.pdf",
        resume_text=resume_text,
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
        missing_keywords=list(result.get("missing_keywords") or []),
        improvement_suggestions=list(result.get("improvement_suggestions") or []),
        strengths=list(result.get("strengths") or []),
        short_summary=str(result.get("short_summary") or ""),
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

