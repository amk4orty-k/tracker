# Sprint 2: User Profiles & Theme Customization

## Completed Improvements

### 🎨 1. Fixed GYM Background Text Cutoff
**Problem:** The diagonal "GYM" background pattern had text being cut off at edges
**Solution:** 
- Increased SVG viewBox from 240x240 to 300x300
- Adjusted text positioning to ensure full visibility
- Added `background-repeat: no-repeat, repeat` for proper tiling
- Increased background-size to 320x320px for better coverage
- Added overflow: hidden to prevent any clipping artifacts

### 👤 2. Per-User Profiles with Current & Ideal Stats
**Features Added:**
- Each user can now set their own profile:
  - Current weight (kg)
  - Height (cm)
  - Age
  - Sex (male/female)
  - Ideal/goal weight (kg)
  - Theme color preference
  
**Backend Changes:**
- Created `user_profiles` table in database
- Added `/user/profile` GET endpoint to fetch profile
- Added `/user/profile` PUT endpoint to update profile
- Automatic profile creation on user signup (via trigger)
- All calculations now use per-user data

**Frontend Changes:**
- Profile loaded on app start
- Maintenance calorie calculation uses user's actual stats (Mifflin-St Jeor Equation)
- Weight recommendations based on user's current weight
- Ideal profile used for goal visualization

### 🎨 3. Theme Color Customization
**Features:**
- 8 pre-defined color themes:
  - Crimson (default red)
  - Electric Blue
  - Purple
  - Emerald Green
  - Orange
  - Pink
  - Cyan
  - Lime
- CSS variables now use HSL with dynamic `--theme-hue`
- Theme persists across sessions (stored in user profile)
- Real-time color switching without page reload

**Technical Implementation:**
- Changed from static hex colors to HSL with variable hue
- All accent colors dynamically generated from single hue value
- Color picker in settings panel
- Theme applied on login and profile update

### ⚙️ 4. Settings Panel
**New UI Component:**
- Accessible via "⚙️ Settings" button in header
- Modal overlay with glassmorphism styling
- Sections:
  - **Account**: Shows email, logout button
  - **Current Profile**: Weight, height, age, sex inputs
  - **Goal Weight**: Ideal weight target
  - **Theme Color**: Visual color picker with 8 options
- Save button updates profile in database
- Non-destructive logout (data persists)

### 🔐 5. Persistent Authentication
**Improvements:**
- Sessions automatically persist via Supabase's built-in storage
- Users stay logged in across browser restarts
- Logout doesn't clear any user data (only clears session token)
- Auto-refresh tokens prevent session expiration
- No "forgotten user" issues

### 📊 6. Personalized Calculations
**Algorithm Updates:**
- Maintenance calories calculated per user using:
  - BMR = 10 × weight + 6.25 × height - 5 × age + offset (sex-dependent)
  - Activity factor: 1.55 (moderate gym activity)
- Weight recommendations scaled to user's body weight
- Progressive overload targets adapted to user's strength level
- Ideal profile used for future projections

## Database Changes

### New Table: `user_profiles`
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  current_weight_kg DECIMAL(5,2) DEFAULT 70,
  height_cm INTEGER DEFAULT 175,
  ideal_weight_kg DECIMAL(5,2) DEFAULT 85,
  age INTEGER DEFAULT 25,
  sex VARCHAR(10) DEFAULT 'male',
  theme_color VARCHAR(7) DEFAULT '#ff2f54',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### RLS Policies
- Users can only view/edit their own profile
- Auto-create profile trigger on user signup
- Indexed on user_id for fast lookups

## Files Created/Modified

### Created:
1. `frontend/components/SettingsPanel.tsx` - Settings modal component
2. `frontend/pages/api/profile_proxy.ts` - Profile API proxy
3. `migrations/002_user_profiles.sql` - Database migration

### Modified:
1. `main.py` - Added `/user/profile` endpoints
2. `frontend/styles/globals.css` - Fixed GYM text, added HSL theme variables
3. `frontend/pages/index.tsx` - Integrated user profiles, settings button
4. `AUTH_SETUP.md` - Updated with new table info

## User Experience Improvements

### Before:
- Hardcoded 70kg/85kg weights for all users
- Fixed red color theme
- Generic calorie recommendations
- No way to customize profile
- Logout removed "Log out" from header (confusing UX)

### After:
- Each user sets their actual stats
- 8 color themes to choose from
- Personalized calorie calculations
- Comprehensive settings panel
- Clear "Settings" button with logout inside
- Data persists even after logout

## Setup Instructions

### 1. Run Database Migration
```bash
# In Supabase SQL Editor, run:
migrations/002_user_profiles.sql
```

### 2. Install Dependencies (if needed)
```bash
cd frontend
npm install  # Installs @supabase/supabase-js if not already done
```

### 3. Test Multi-User Profiles
1. Log in as User A
2. Open Settings, set:
   - Current weight: 70kg
   - Ideal weight: 80kg
   - Theme: Crimson
3. Save and verify calculations use 70kg
4. Log out and log in as User B
5. Set different stats (e.g., 90kg current, Purple theme)
6. Verify User B sees their own profile, not User A's

## Technical Details

### Theme Color System
```css
/* Old (static) */
--accent: #ff2f54;

/* New (dynamic) */
--theme-hue: 348;  /* Changed via JS */
--accent: hsl(var(--theme-hue), 100%, 59%);
```

### Calorie Calculation
```typescript
// Mifflin-St Jeor BMR formula
if (sex === 'male') {
  bmr = 10 * weight + 6.25 * height - 5 * age + 5
} else {
  bmr = 10 * weight + 6.25 * height - 5 * age - 161
}
maintenanceCalories = bmr * 1.55  // Moderate activity
```

### Profile Loading Flow
```
1. User logs in → AuthContext sets session
2. index.tsx detects session → calls loadUserProfile()
3. GET /api/profile_proxy → backend GET /user/profile
4. Backend queries user_profiles table filtered by user_id
5. Profile returned → state updated, theme applied
6. All calculations now use user's actual stats
```

## Security
- RLS policies ensure users can only access their own profiles
- JWT authentication required for all profile endpoints
- Theme color validated (must be 7-char hex)
- No cross-user data leakage

## Performance
- Profile loaded once on app start
- Cached in React state
- Only re-fetched when explicitly updated
- Database indexed on user_id for fast queries

## Future Enhancements
- Unit preference (kg/lbs, cm/inches)
- Custom color picker (not just presets)
- Profile photo upload
- Export profile data
- Share workout plans between users
- Coach/athlete role system
