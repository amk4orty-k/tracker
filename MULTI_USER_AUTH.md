# Gym Tracker - Multi-User Authentication Implementation

## Changes Summary

### Backend Changes (`main.py`)
1. **JWT Authentication**
   - Added `PyJWT==2.8.0` to `requirements.txt`
   - Created `get_current_user_id()` dependency that extracts `user_id` from JWT token
   - All endpoints now require authentication via `Depends(get_current_user_id)`

2. **User-Scoped Queries**
   - Updated `_rest_get()` calls to filter by `user_id` in all endpoints:
     - `/session` - filters sessions by user
     - `/recommendation_dynamic` - fetches only user's sets
     - `/analytics` - returns only user's progression data
   - Sets insertions now include `user_id` field

3. **Per-User Recommendations**
   - `calculate_dynamic_recommendation()` and `calculate_ai_recommendation()` now receive filtered data per user
   - PR calculations, fatigue detection, and trend analysis are user-specific

### Frontend Changes

1. **Authentication Context** (`contexts/AuthContext.tsx`)
   - Created React context for auth state management
   - Provides `signIn`, `signUp`, `signOut` methods
   - Manages session state via Supabase Auth
   - Auto-refreshes tokens

2. **Login Page** (`pages/login.tsx`)
   - Email/password authentication form
   - Toggle between login and signup modes
   - Styled to match app theme (crimson/black Nintendo palette)
   - Redirects to main app on successful login

3. **Protected Routes** (`pages/index.tsx`)
   - Auth guard checks session on load
   - Redirects to `/login` if not authenticated
   - Shows loading state during auth check
   - Added "Log out" button in header
   - All API calls now include `Authorization: Bearer <token>` header

4. **API Proxies** (`pages/api/*.ts`)
   - `session_proxy.ts` - forwards auth header to backend
   - `recommendation_proxy.ts` - includes JWT in requests
   - `analytics_proxy.ts` - passes user token to backend

5. **Supabase Client** (`lib/supabaseClient.ts`)
   - Initialized with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Shared instance across app

6. **Dependencies** (`package.json`)
   - Added `@supabase/supabase-js@^2.38.0` for auth SDK

### Database Requirements

**Required Columns:**
```sql
-- Add user_id to sessions table
ALTER TABLE sessions ADD COLUMN user_id uuid REFERENCES auth.users(id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Add user_id to sets table
ALTER TABLE sets ADD COLUMN user_id uuid;
CREATE INDEX idx_sets_user_id ON sets(user_id);
```

**Row Level Security (RLS):**
```sql
-- Enable RLS on sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id);

-- Enable RLS on sets
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own sets"
  ON sets FOR ALL
  USING (auth.uid() = user_id);
```

### Environment Variables

**Backend (`.env`):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
BACKEND_URL=http://localhost:8000
```

### Security Model

1. **Frontend Layer**
   - Supabase Auth SDK manages user sessions
   - JWT tokens stored securely by Supabase client
   - Automatic token refresh
   - Auth guards prevent unauthorized access to pages

2. **API Layer**
   - Next.js API routes forward `Authorization` header
   - No credentials exposed to client-side code

3. **Backend Layer**
   - FastAPI dependency validates JWT on every request
   - Extracts `user_id` from token claims
   - All queries filtered by authenticated user

4. **Database Layer**
   - RLS policies enforce row-level isolation
   - Even if backend logic fails, database blocks unauthorized access
   - Service role key bypasses RLS (used by backend only)

### Data Flow

**User Login:**
```
1. User enters email/password in /login
2. Frontend calls supabase.auth.signInWithPassword()
3. Supabase returns JWT access token
4. Token stored in AuthContext state
5. User redirected to main app (/)
```

**API Request:**
```
1. User triggers action (e.g., finish session)
2. Frontend calls getAuthHeaders() to retrieve token
3. Request sent to /api/session_proxy with Authorization header
4. Next.js proxy forwards header to FastAPI backend
5. Backend extracts user_id from JWT via get_current_user_id()
6. Query executed with user_id filter
7. Response returned to frontend
```

**Data Isolation:**
```
User A (uid: abc-123):
  - sees sessions where user_id = abc-123
  - recommendations based on their sets only
  - PRs calculated from their history

User B (uid: def-456):
  - sees sessions where user_id = def-456
  - completely separate data
  - no cross-user data leakage
```

### Testing Steps

1. **Setup**
   - Configure environment variables
   - Run migrations to add user_id columns
   - Enable RLS policies

2. **Create Test Users**
   ```
   User A: user-a@test.com
   User B: user-b@test.com
   ```

3. **Test Isolation**
   - Log in as User A
   - Create 2-3 workout sessions
   - Log out
   - Log in as User B
   - Verify empty state (no User A data visible)
   - Create different sessions
   - Log out and back as User A
   - Verify only User A's original data is visible

4. **Test Recommendations**
   - Each user should get recommendations based only on their own history
   - PRs should be user-specific
   - Fatigue scores calculated per user

### Migration Path for Existing Data

If you have existing data without `user_id`:

```sql
-- Create a test user ID for migration
-- Option 1: Assign all to first user
UPDATE sessions SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
UPDATE sets SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- Option 2: Delete orphaned data
DELETE FROM sets WHERE session_id IN (SELECT id FROM sessions WHERE user_id IS NULL);
DELETE FROM sessions WHERE user_id IS NULL;
```

### Deployment Checklist

- [ ] Backend environment variables set
- [ ] Frontend environment variables set
- [ ] Database migrations applied (user_id columns)
- [ ] RLS policies enabled
- [ ] Test multi-user flow in production
- [ ] CORS configured for production domains
- [ ] HTTPS enabled (required for Supabase Auth)
- [ ] Verify JWT secret matches Supabase project

### Known Limitations

1. **Password Reset**: Not implemented yet (can add Supabase's built-in flow)
2. **Email Verification**: Uses Supabase default (check Settings > Authentication)
3. **Social Logins**: Not configured (can add Google/GitHub via Supabase)
4. **Session Timeout**: Uses Supabase defaults (1 hour access token, 7 day refresh)

### Next Steps

- Add password reset flow
- Implement email verification UI
- Add social login options (Google/GitHub)
- Create user profile management page
- Add user settings (preferred units, theme, etc.)
- Implement workout sharing between users (future feature)
