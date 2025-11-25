-- Migration: Create sessions and sets tables
-- Run this in Supabase SQL Editor
-- This will drop existing tables and recreate them fresh

-- Step 1: Drop existing tables if they exist
DROP TABLE IF EXISTS sets CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- Step 2: Create sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    day_type TEXT,
    calories INTEGER DEFAULT 0,
    finished BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3: Create sets table
CREATE TABLE sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    exercise TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    weight DECIMAL(10, 2) NOT NULL,
    reps INTEGER NOT NULL,
    intensity INTEGER DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 4: Create indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_user_date ON sessions(user_id, date);
CREATE INDEX idx_sets_session_id ON sets(session_id);
CREATE INDEX idx_sets_user_id ON sets(user_id);
CREATE INDEX idx_sets_exercise ON sets(exercise);
CREATE INDEX idx_sets_user_exercise ON sets(user_id, exercise);

-- Step 5: Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for sessions
CREATE POLICY sessions_select_policy ON sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY sessions_insert_policy ON sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY sessions_update_policy ON sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY sessions_delete_policy ON sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Step 7: Create RLS policies for sets
CREATE POLICY sets_select_policy ON sets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY sets_insert_policy ON sets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY sets_update_policy ON sets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY sets_delete_policy ON sets
    FOR DELETE USING (auth.uid() = user_id);

-- Step 8: Create trigger function
CREATE OR REPLACE FUNCTION update_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger
CREATE TRIGGER trigger_update_sessions_timestamp
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_sessions_timestamp();
