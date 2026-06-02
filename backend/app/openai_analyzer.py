import json
import re
from typing import Any

from openai import OpenAI

from app.settings import settings


SYSTEM_PROMPT = """You are an ATS-style resume evaluator.
When a job description is provided, compare against it.
When no job description is provided, run a resume-only review and score overall resume readiness.
Produce a strict JSON object that follows the requested keys.
Be specific and avoid fluff.
"""


COMMON_RESUME_KEYWORDS = {
    "python",
    "javascript",
    "typescript",
    "react",
    "node",
    "sql",
    "aws",
    "docker",
    "kubernetes",
    "git",
    "api",
    "fastapi",
    "django",
    "flask",
    "excel",
    "tableau",
    "power bi",
    "machine learning",
    "data analysis",
    "project management",
    "agile",
    "scrum",
}


def _extract_strength_hints(resume_text: str) -> list[str]:
    text = resume_text.lower()
    strengths: list[str] = []

    if re.search(r"\b(\d+%|\$?\d+[kKmM]?|\d+\+?)\b", resume_text):
        strengths.append("Includes measurable outcomes (numbers/metrics), which improves credibility.")
    if any(word in text for word in ("led", "managed", "mentored", "owned", "launched", "delivered")):
        strengths.append("Shows ownership/leadership language in work experience.")
    if any(word in text for word in ("project", "portfolio", "github", "built", "developed")):
        strengths.append("Demonstrates hands-on project/build experience.")
    if any(word in text for word in ("python", "javascript", "typescript", "react", "sql", "aws")):
        strengths.append("Lists relevant technical skills and tools.")

    if not strengths:
        strengths.append("Resume provides foundational information and can be strengthened with clearer impact bullets.")
    return strengths[:5]


def _resume_only_local_analysis(resume_text: str) -> dict[str, Any]:
    text = resume_text.lower()
    matched_keywords = [k for k in COMMON_RESUME_KEYWORDS if k in text]
    missing_keywords = [k for k in COMMON_RESUME_KEYWORDS if k not in text][:8]

    score = 45
    if re.search(r"\b(\d+%|\$?\d+[kKmM]?|\d+\+?)\b", resume_text):
        score += 20
    if any(word in text for word in ("led", "managed", "owned", "delivered")):
        score += 15
    if len(matched_keywords) >= 6:
        score += 15
    elif len(matched_keywords) >= 3:
        score += 8

    score = max(0, min(100, score))

    return {
        "match_score": score,
        "missing_keywords": missing_keywords,
        "strengths": _extract_strength_hints(resume_text),
        "improvement_suggestions": [
            "Rewrite top experience bullets as action + impact (include numbers where possible).",
            "Add a concise skills section with core tools, frameworks, and platforms.",
            "Tailor headline/summary to your target role and seniority.",
            "Prioritize the strongest, most relevant projects/experience near the top.",
            "Use clear ATS-friendly wording for skills and responsibilities.",
        ],
        "short_summary": "Resume-only analysis ran without an LLM key. The score reflects structure, evidence of impact, and keyword coverage heuristics.",
        "analysis_mode": "resume_only",
        "analysis_engine": "local_heuristic",
    }


def _build_client_and_model(provider: str) -> tuple[OpenAI, str]:
    if provider == "groq":
        return OpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1"), settings.groq_model
    return OpenAI(api_key=settings.openai_api_key), settings.openai_model


def analyze_resume_vs_job(
    resume_text: str,
    job_description: str | None = None,
    analysis_source: str | None = None,
) -> dict[str, Any]:
    job_description_clean = (job_description or "").strip()
    is_resume_only = not job_description_clean
    requested_source = (analysis_source or "auto").strip().lower()
    provider = (settings.llm_provider or "groq").strip().lower()
    has_groq = bool(settings.groq_api_key)
    has_openai = bool(settings.openai_api_key)

    if requested_source in {"groq", "openai", "local_heuristic"}:
        provider = requested_source

    if provider == "local_heuristic":
        if is_resume_only:
            return _resume_only_local_analysis(resume_text)
        raise RuntimeError("local_heuristic is only available in resume-only mode")

    if requested_source == "auto":
        if provider == "groq" and not has_groq and has_openai:
            provider = "openai"
        elif provider == "openai" and not has_openai and has_groq:
            provider = "groq"

    if provider == "groq" and not has_groq:
        if is_resume_only:
            return _resume_only_local_analysis(resume_text)
        raise RuntimeError("GROQ_API_KEY is not set")
    if provider == "openai" and not has_openai:
        if is_resume_only:
            return _resume_only_local_analysis(resume_text)
        raise RuntimeError("OPENAI_API_KEY is not set")

    client, model = _build_client_and_model(provider)

    user_prompt = f"""
RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description_clean if job_description_clean else "(none provided)"}

Return JSON with exactly these keys:
- match_score: integer 0-100
- missing_keywords: array of strings
- strengths: array of strings
- improvement_suggestions: array of strings (concrete resume edits: add bullets, quantify, reorder, projects)
- short_summary: string (1-3 sentences)

Mode instructions:
- If JOB DESCRIPTION is provided: treat match_score as job fit score, and missing_keywords as JD keywords/skills missing from resume.
- If JOB DESCRIPTION is not provided: treat match_score as overall resume readiness score, and use missing_keywords for important resume keywords/skills likely missing or underemphasized.
"""

    resp = client.chat.completions.create(
        model=model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        data = {"match_score": 0, "missing_keywords": [], "strengths": [], "improvement_suggestions": [], "short_summary": "", "error": "Invalid JSON from model", "raw_text": content}

    # Defensive normalization
    data.setdefault("missing_keywords", [])
    data.setdefault("strengths", [])
    data.setdefault("improvement_suggestions", [])
    data.setdefault("short_summary", "")
    try:
        score = int(data.get("match_score", 0))
    except Exception:
        score = 0
    data["match_score"] = max(0, min(100, score))
    data["analysis_mode"] = "resume_only" if is_resume_only else "job_match"
    data.setdefault("analysis_engine", provider)

    return data

