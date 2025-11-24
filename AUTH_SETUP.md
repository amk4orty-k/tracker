# Gym Tracker - Multi-User Auth Setup

## Overview
The app now supports Supabase Auth with per-user data isolation. Each user sees only their own sessions, sets, and recommendations.

## Setup Instructions

### 1. Backend Setup
1. Copy `.env.example` to `.env` in the root directory
2. Fill in your Supabase credentials:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your service role key (from Supabase dashboard > Settings > API)
   - `SUPABASE_JWT_SECRET`: Your JWT secret (same as service role key or from Settings > API > JWT Settings)

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the backend:
   ```bash
   python main.py
   ```

### 2. Frontend Setup
1. Navigate to `frontend/` directory
2. Copy `.env.local.example` to `.env.local`
3. Fill in your Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon/public key (from Supabase dashboard)
   - `BACKEND_URL`: Backend URL (default: http://localhost:8000)

4. Install dependencies:
   ```bash
   npm install
   ```

5. Run the frontend:
   ```bash
   npm run dev
   ```

### 3. Database Setup
Ensure your Supabase tables have `user_id` columns:

**sessions table:**
```sql
ALTER TABLE sessions ADD COLUMN user_id uuid REFERENCES auth.users(id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
```

**sets table:**
```sql
ALTER TABLE sets ADD COLUMN user_id uuid;
CREATE INDEX idx_sets_user_id ON sets(user_id);
```

**user_profiles table (NEW):**
```sql
-- Run the migration file: migrations/002_user_profiles.sql
-- Or copy the contents and run in Supabase SQL Editor
```

Enable Row Level Security (RLS) policies:
```sql
-- Sessions table policy
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id);

-- Sets table policy
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own sets"
  ON sets FOR ALL
  USING (auth.uid() = user_id);

-- User profiles policies are in the migration file
```

### 4. Usage
1. Navigate to http://localhost:3000
2. You'll be redirected to `/login`
3. Sign up with email/password (check email for confirmation if required)
4. Log in to access your personalized gym tracker
5. All sessions and progress are isolated to your user account

### 5. Multi-User Testing
1. Create two accounts with different emails
2. Log in as User A, create some sessions
3. Log out and log in as User B
4. Verify User B sees empty data (not User A's sessions)
5. Create sessions as User B
6. Switch back to User A - data should be isolated

## Authentication Flow
- Frontend: Supabase Auth with JWT tokens
- Backend: JWT validation extracts `user_id` from token
- Database: All queries filtered by `user_id` automatically
- Security: RLS policies enforce data isolation at database level

## Deployment Notes
- Set environment variables in Vercel/production for frontend
- Set environment variables in your backend host (e.g., Railway, Render)
- Ensure CORS is configured properly for production domains
- Use HTTPS in production (required for Supabase Auth)
