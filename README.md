# JobJeeves (Resume ↔ Job Description Matcher)

## What it does

- **Upload PDF resume**
- **Extract text**
- **Compare vs job description (OpenAI)**
- **Return**: match score, missing keywords, improvement suggestions
- **Store results** in PostgreSQL

## Quickstart (Docker)

1) Create a local `.env` (same folder as `docker-compose.yml`) with:

- `GROQ_API_KEY=...`
- (optional) `LLM_PROVIDER=groq` (default)
- (optional) `GROQ_MODEL=llama-3.1-8b-instant`

Tip: see `env.sample` for all knobs.

2) Start everything:

```bash
docker compose up --build
```

3) Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/api/health`

## Local dev (no Docker)

Backend (defaults to SQLite `dev.db`):

```bash
python -m venv .venv
source .venv/Scripts/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## API

- `POST /api/analyze` (multipart/form-data)
  - `file`: PDF
  - `job_description`: string

## Notes / Limitations

- **Scanned PDFs** (images) usually won’t extract text without OCR.

