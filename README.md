# Gym Tracker

A full-stack gym tracking application with AI-powered workout recommendations, progressive overload tracking, and multi-user authentication.

## Features

✨ **Multi-User Authentication**
- Secure JWT-based authentication via Supabase Auth
- Email/password login and signup
- Per-user data isolation
- Automatic token refresh
- Persistent sessions (stay logged in)

👤 **Personalized User Profiles**
- Set your own current weight, height, age, and sex
- Define ideal/goal weight for progress tracking
- Personalized calorie calculations using Mifflin-St Jeor Equation
- All recommendations adapted to YOUR body stats
- Comprehensive settings panel for profile management

🎨 **Theme Customization**
- Choose from 8 color themes (Crimson, Blue, Purple, Emerald, Orange, Pink, Cyan, Lime)
- Real-time theme switching
- Theme persists across sessions
- Glassmorphism design adapts to your chosen color

💪 **Workout Tracking**
- Weekly split planner (Chest, Legs, Back, Shoulders & Arms)
- Progressive overload tracking
- Real-time weight and rep suggestions
- Instant feedback system (too easy/too hard/on target)

🤖 **AI-Powered Recommendations**
- Dynamic weight and rep suggestions based on YOUR recent performance
- Fatigue detection and recovery optimization
- Trend analysis and plateau detection
- Calorie correlation analysis
- Recommendations scaled to your body weight

📊 **Analytics & Progress**
- Personal records (PRs) tracking
- Training volume monitoring
- Workout streak tracking
- Exercise progression charts
- Goal visualization (current vs ideal weight)

🎨 **Modern UI**
- Choose your theme color
- Glassmorphism design
- Animated background patterns (fixed GYM text cutoff!)
- Responsive mobile-first layout

## Tech Stack

**Frontend:**
- Next.js 13 + React 18 + TypeScript
- Supabase Auth for authentication
- Axios for API calls
- Recharts for data visualization
- Custom CSS with glassmorphism effects

**Backend:**
- FastAPI (Python)
- Supabase PostgreSQL database
- JWT authentication
- PostgREST for database access

**Database:**
- Supabase PostgreSQL
- Row Level Security (RLS) policies
- Indexed user_id columns for performance

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- Supabase account

### 1. Clone Repository
```bash
git clone https://github.com/amk4orty-k/tracker.git
cd tracker
```

### 2. Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run backend
python main.py
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

### 4. Database Setup
Run the SQL migrations in your Supabase SQL Editor:

```sql
-- Add user_id columns
ALTER TABLE sessions ADD COLUMN user_id uuid REFERENCES auth.users(id);
ALTER TABLE sets ADD COLUMN user_id uuid;

-- Create indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sets_user_id ON sets(user_id);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only see their own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own sets"
  ON sets FOR ALL
  USING (auth.uid() = user_id);
```

**Then run the user profiles migration:**
```bash
# Copy and paste contents of migrations/002_user_profiles.sql into Supabase SQL Editor
# This creates the user_profiles table with RLS policies
```

### 5. Access Application
Navigate to `http://localhost:3000` and sign up for an account!

### 6. Customize Your Profile
1. Click "⚙️ Settings" in the header
2. Set your current weight, height, age, and sex
3. Set your ideal/goal weight
4. Choose your theme color
5. Save and enjoy personalized recommendations!

## Documentation

- 📖 [Multi-User Authentication Guide](AUTH_SETUP.md)
- 📋 [Implementation Details](MULTI_USER_AUTH.md)
- 📝 [File Changes Summary](CHANGES.md)
- 🚀 [Sprint 2: User Profiles & Theme Customization](SPRINT2_SUMMARY.md)

## Environment Variables

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

## API Endpoints

### Authentication
All endpoints require `Authorization: Bearer <token>` header.

### Workouts
- `POST /session` - Log workout session with sets
- `GET /recommendation_dynamic` - Get weight/rep recommendations
- `GET /analytics` - Get progression data for exercises

## User Profiles

The app supports fully personalized profiles for each user:
- **Current Profile**: Your actual stats (weight, height, age, sex)
- **Ideal Profile**: Your target goal weight
- **Theme Color**: Choose from 8 color themes
- **Maintenance Calories**: Automatically calculated using Mifflin-St Jeor Equation

All recommendations, progressive overload targets, and analytics are calculated based on YOUR specific profile!

## Security

- JWT-based authentication
- Row Level Security (RLS) at database level
- User-scoped queries in backend
- Automatic token refresh
- Secure credential storage

## Multi-User Testing

To verify data isolation and personalization:
1. Sign up as User A (user-a@test.com)
2. Open Settings and set:
   - Current weight: 70kg
   - Ideal weight: 80kg
   - Theme: Crimson
   - Age: 25, Sex: Male
3. Complete 2-3 workout sessions
4. Log out (your data is saved!)
5. Sign up as User B (user-b@test.com)
6. Set different profile:
   - Current weight: 90kg
   - Theme: Purple
7. Verify User B sees empty workout history
8. Complete different workouts as User B
9. Log back as User A - verify only User A's data is visible
10. Check that recommendations are different based on each user's weight/stats

## Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BACKEND_URL`

### Backend (Railway/Render)
Set environment variables in your hosting platform:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_JWT_SECRET`

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

For setup help or bug reports, open an issue on GitHub.

## Roadmap

- [x] User profile customization (weight, height, age, sex)
- [x] Theme color selection (8 themes)
- [x] Persistent authentication
- [x] Per-user calorie calculations
- [ ] Password reset flow
- [ ] Email verification UI
- [ ] Social login (Google/GitHub)
- [ ] Custom color picker (beyond 8 presets)
- [ ] Unit preferences (kg/lbs, cm/inches)
- [ ] Exercise library expansion
- [ ] Workout sharing between users
- [ ] Mobile app (React Native)
- [ ] Progressive Web App (PWA) support
- [ ] Profile photo upload
- [ ] Export workout data (CSV/JSON)
