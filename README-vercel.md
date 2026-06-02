# Deploying JobJeeves Frontend to Vercel

This branch (`vercel-deployable`) contains the frontend configured for deployment to Vercel.

## Important: Backend Must Be Hosted Separately

The backend API must be hosted separately from Vercel. The frontend will make API requests to the backend URL you configure.

## Setup Instructions

### 1. Deploy the Backend

Deploy the backend to a hosting service that supports Python/FastAPI (e.g., Railway, Render, Fly.io, AWS, etc.). The backend is located in the `backend/` directory.

**Important:** Make sure your backend:
- Has CORS configured to allow requests from your Vercel domain
- Is accessible via HTTPS (required for production)
- Exposes the API at `/api/*` endpoints

### 2. Configure Vercel Environment Variable

In your Vercel project settings, add the following environment variable:

- **Variable Name:** `VITE_API_URL`
- **Value:** Your backend API URL (e.g., `https://your-backend.railway.app` or `https://api.yourdomain.com`)

**Important:** 
- Do NOT include a trailing slash
- Use the full URL including `https://`
- Example: `https://jobjeeves-backend.railway.app`

### 3. Deploy to Vercel

1. Connect your repository to Vercel
2. Set the **Root Directory** to `frontend` (or deploy from the `frontend` directory)
3. Vercel will automatically detect Vite and configure the build
4. The build command should be: `npm run build`
5. The output directory should be: `dist`

### 4. Verify Deployment

After deployment, test that:
- The frontend loads correctly
- API requests are made to your backend URL (check browser Network tab)
- CORS is properly configured on your backend

## Local Development

For local development, you can still use the original setup:

```bash
# Backend (from project root)
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend (from project root)
cd frontend
npm install
npm run dev
```

The frontend will use the Vite proxy (`/api`) when `VITE_API_URL` is not set, which works for local development.

## Troubleshooting

- **CORS errors:** Make sure your backend's `CORS_ORIGINS` includes your Vercel domain
- **404 on API calls:** Verify `VITE_API_URL` is set correctly in Vercel (no trailing slash)
- **Build fails:** Ensure you're deploying from the `frontend` directory or set Root Directory in Vercel

## Returning to Main Branch

The main branch retains the original Docker Compose setup for local development. This branch is specifically for Vercel deployment.
