-- Add avatar_url to creators table
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Ensure RLS allows update of this column (existing policy should cover it, but good to be safe)
-- "Creators can update their own profile" policy covers all columns for update.
