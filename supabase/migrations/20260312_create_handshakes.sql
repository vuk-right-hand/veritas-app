-- Handshake (follow) system: users handshake creators to express interest.
-- Future: creators can email their handshaked audience.

CREATE TABLE public.handshakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, creator_id)
);

-- Fast lookups: "how many handshakes does this creator have?" and "what are my handshakes?"
CREATE INDEX idx_handshakes_creator ON public.handshakes (creator_id);
CREATE INDEX idx_handshakes_user ON public.handshakes (user_id);

ALTER TABLE public.handshakes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own handshakes (privacy)
CREATE POLICY "Users can view own handshakes"
    ON public.handshakes FOR SELECT USING (auth.uid() = user_id);

-- Users can only create handshakes for themselves
CREATE POLICY "Users can insert own handshakes"
    ON public.handshakes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only remove their own handshakes
CREATE POLICY "Users can delete own handshakes"
    ON public.handshakes FOR DELETE USING (auth.uid() = user_id);
