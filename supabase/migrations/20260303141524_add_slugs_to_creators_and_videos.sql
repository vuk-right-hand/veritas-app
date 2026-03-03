-- Phase 1.1: Schema Updates
ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Phase 1.2: The Bulletproof Slugify Function
CREATE OR REPLACE FUNCTION public.slugify(v TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  chars_to_replace TEXT := '[\[\]<>~#^|%&*+$?!''"()@,;:\/\\\. ]';
BEGIN
  -- Convert to lowercase
  base_slug := lower(v);
  -- Replace special chars with hyphen
  base_slug := regexp_replace(base_slug, chars_to_replace, '-', 'g');
  -- Remove multiple consecutive hyphens
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  -- Trim hyphens from start and end
  base_slug := trim(both '-' from base_slug);
  
  -- Fallback if slug is empty (e.g., emojis or non-latin chars)
  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := substr(gen_random_uuid()::text, 1, 8);
  END IF;

  RETURN base_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Phase 1.3: The Backfill Logic (Collision Handling)
DO $$
DECLARE
  rec RECORD;
  new_slug TEXT;
  is_unique BOOLEAN;
BEGIN
  -- Backfill creators
  FOR rec IN SELECT id, channel_name FROM public.creators WHERE slug IS NULL AND channel_name IS NOT NULL LOOP
    new_slug := public.slugify(rec.channel_name);
    is_unique := FALSE;
    
    WHILE NOT is_unique LOOP
      IF EXISTS (SELECT 1 FROM public.creators WHERE slug = new_slug AND id != rec.id) THEN
        new_slug := new_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
      ELSE
        is_unique := TRUE;
      END IF;
    END LOOP;
    
    UPDATE public.creators SET slug = new_slug WHERE id = rec.id;
  END LOOP;

  -- Backfill videos
  FOR rec IN SELECT id, title FROM public.videos WHERE slug IS NULL AND title IS NOT NULL LOOP
    new_slug := public.slugify(rec.title);
    is_unique := FALSE;
    
    WHILE NOT is_unique LOOP
      IF EXISTS (SELECT 1 FROM public.videos WHERE slug = new_slug AND id != rec.id) THEN
        new_slug := new_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
      ELSE
        is_unique := TRUE;
      END IF;
    END LOOP;
    
    UPDATE public.videos SET slug = new_slug WHERE id = rec.id;
  END LOOP;
END;
$$;
