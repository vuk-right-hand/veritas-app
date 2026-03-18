-- Track unsubscribed emails — check before every send
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON public.email_unsubscribes(email);

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only
