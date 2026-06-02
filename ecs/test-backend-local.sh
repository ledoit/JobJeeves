#!/bin/bash
set -e

# Test script to verify backend works with Supabase Postgres locally
# This helps verify configuration before deploying to ECS

echo "🧪 Testing JobJeeves backend with Supabase Postgres..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo "Set it to your Supabase connection string:"
  echo "  export DATABASE_URL='postgresql+psycopg://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres'"
  exit 1
fi

echo "✅ DATABASE_URL is set"

# Check if API key is set
if [ -z "$GROQ_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  echo "⚠️  WARNING: Neither GROQ_API_KEY nor OPENAI_API_KEY is set"
  echo "Set at least one:"
  echo "  export GROQ_API_KEY='your-key'"
  echo "  export OPENAI_API_KEY='your-key'"
fi

# Set CORS if not set
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173}"

echo "📦 Starting backend server..."
echo "Database: $DATABASE_URL"
echo "CORS Origins: $CORS_ORIGINS"
echo ""

cd "$(dirname "$0")/../backend"

# Install dependencies if needed
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python -m venv .venv
fi

source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null

pip install -q -r requirements.txt

echo ""
echo "🚀 Starting server on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""
echo "Test endpoints:"
echo "  Health: curl http://localhost:8000/api/health"
echo "  Analyze: curl -X POST http://localhost:8000/api/analyze -F 'file=@resume.pdf' -F 'job_description=...'"
echo ""

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
