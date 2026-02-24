-- Migration: Proof of Work Quiz System
-- Creates video_quizzes, quiz_attempts tables and adds skills_matrix JSONB to profiles

-- 1. Pre-generated quiz questions per video (populated when video is analyzed)
CREATE TABLE IF NOT EXISTS video_quizzes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id text NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    lesson_number int NOT NULL CHECK (lesson_number BETWEEN 1 AND 3),
    skill_tag text NOT NULL,
    question_text text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Unique constraint: one question per lesson per video
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_quizzes_video_lesson
    ON video_quizzes(video_id, lesson_number);

-- Index for fast lookup by video
CREATE INDEX IF NOT EXISTS idx_video_quizzes_video_id
    ON video_quizzes(video_id);

-- 2. Immutable ledger of all quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL,
    video_id text NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    topic text NOT NULL,
    question text NOT NULL,
    user_answer text NOT NULL,
    ai_feedback text,
    confidence text CHECK (confidence IN ('low', 'medium', 'high')),
    passed boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Index for user history lookups
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id
    ON quiz_attempts(user_id);

-- Index for video-level stats
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_video_id
    ON quiz_attempts(video_id);

-- 3. Add skills_matrix JSONB column to profiles
-- Structure: { "topic_slug": { "quiz_score": 0, "tier": "Uncommon", "portfolio": [] } }
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS skills_matrix jsonb DEFAULT '{}'::jsonb;

-- RLS Policies
ALTER TABLE video_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read quiz questions
CREATE POLICY "Anyone can read video quizzes"
    ON video_quizzes FOR SELECT
    USING (true);

-- Allow service role to insert quiz questions (via API route)
CREATE POLICY "Service role can insert video quizzes"
    ON video_quizzes FOR INSERT
    WITH CHECK (true);

-- Allow anyone to read quiz attempts (for public profiles)
CREATE POLICY "Anyone can read quiz attempts"
    ON quiz_attempts FOR SELECT
    USING (true);

-- Allow anyone to insert quiz attempts
CREATE POLICY "Anyone can insert quiz attempts"
    ON quiz_attempts FOR INSERT
    WITH CHECK (true);
