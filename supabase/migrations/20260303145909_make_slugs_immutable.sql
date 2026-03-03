-- Phase 4.2: Enforce Slug Immutability

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.protect_slug_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- If any application logic tries to update the slug column,
    -- this silently reverts it back to the original value to protect SEO.
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
        NEW.slug = OLD.slug;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Apply to Creators Table
DROP TRIGGER IF EXISTS enforce_creator_slug_immutability ON public.creators;
CREATE TRIGGER enforce_creator_slug_immutability
BEFORE UPDATE ON public.creators
FOR EACH ROW EXECUTE FUNCTION public.protect_slug_immutability();

-- 3. Apply to Videos Table
DROP TRIGGER IF EXISTS enforce_video_slug_immutability ON public.videos;
CREATE TRIGGER enforce_video_slug_immutability
BEFORE UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.protect_slug_immutability();
