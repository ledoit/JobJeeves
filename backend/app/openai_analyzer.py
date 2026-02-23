import json
from typing import Any

from openai import OpenAI

from app.settings import settings


SYSTEM_PROMPT = """You are an ATS-style resume evaluator.
Given a resume and a job description, produce a strict JSON object that follows the requested keys.
Be specific, avoid fluff, and focus on keywords/skills/tools that appear in the job description.
"""


def analyze_resume_vs_job(resume_text: str, job_description: str) -> dict[str, Any]:
    provider = (settings.llm_provider or "openai").strip().lower()
    if provider == "groq":
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        client = OpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
        model = settings.groq_model
    else:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        client = OpenAI(api_key=settings.openai_api_key)
        model = settings.openai_model

    user_prompt = f"""
RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

Return JSON with exactly these keys:
- match_score: integer 0-100
- missing_keywords: array of strings (keywords in the job description that are missing/weak in the resume)
- strengths: array of strings (what the resume already matches well)
- improvement_suggestions: array of strings (concrete resume edits: add bullets, quantify, reorder, projects)
- short_summary: string (1-3 sentences)
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

    return data

