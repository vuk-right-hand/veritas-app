-- Add suggestion_count column to track demand
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS suggestion_count INTEGER DEFAULT 1;

-- Update existing videos to have at least 1
UPDATE public.videos SET suggestion_count = 1 WHERE suggestion_count IS NULL;
