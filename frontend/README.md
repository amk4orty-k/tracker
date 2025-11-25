# Gym Tracker Frontend (Minimal Next.js)

This is a minimal Next.js frontend that calls the FastAPI backend recommendation endpoint via a proxy API route.

Quick start:

1. Install deps

```bash
cd frontend
npm install
```

2. Set backend URL (in development):

```bash
export BACKEND_URL=http://localhost:8000
npm run dev
```

3. Open http://localhost:3000

Notes:
- This is intentionally minimal. The proxy route forwards calls to the FastAPI backend to avoid CORS setup in development.
- Extend the UI components in `pages/index.tsx` and add forms to log sessions.
