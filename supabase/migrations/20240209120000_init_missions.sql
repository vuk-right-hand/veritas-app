-- Migration: Create User Missions and Mission Curations tables
-- Description: Supports the Veritas North Star by allowing users to define missions and linking videos to them.

-- 1. Create USER_MISSIONS table
CREATE TABLE IF NOT EXISTS public.user_missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  obstacle TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  preferences JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Create MISSION_CURATIONS table
CREATE TABLE IF NOT EXISTS public.mission_curations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES public.user_missions(id) ON DELETE CASCADE,
  video_id TEXT REFERENCES public.videos(id) ON DELETE CASCADE,
  curation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_curations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for USER_MISSIONS
-- Users can view their own missions
CREATE POLICY "Users can view own missions" ON public.user_missions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own missions
CREATE POLICY "Users can insert own missions" ON public.user_missions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own missions
CREATE POLICY "Users can update own missions" ON public.user_missions
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. RLS Policies for MISSION_CURATIONS
-- Users can view curations for their missions
CREATE POLICY "Users can view own mission curations" ON public.mission_curations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_missions 
      WHERE user_missions.id = mission_curations.mission_id 
      AND user_missions.user_id = auth.uid()
    )
  );

-- Admins/System can insert curations (Service Role bypasses RLS, but strictly:)
CREATE POLICY "Service Role can insert curations" ON public.mission_curations
  FOR INSERT WITH CHECK (true); 
-- Note: Service role bypasses RLS anyway, but good to have explicit policy if we ever use authenticated admin users.
