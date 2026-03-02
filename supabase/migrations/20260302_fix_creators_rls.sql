-- SECURITY PATCH: Fix creators RLS privilege escalation (C1)
-- The old "Service role can manage all creators" policy used `using (true)` which
-- applied to ALL authenticated users, allowing any logged-in user to insert
-- themselves as a verified creator, bypassing the entire verification flow.
-- The service role bypasses RLS without any policy, so that policy was redundant
-- and dangerous. We replace it with scoped policies only.

-- Drop the dangerous open policy
DROP POLICY IF EXISTS "Service role can manage all creators" ON public.creators;

-- Users can only read their OWN creator profile (already existed, keep it)
DROP POLICY IF EXISTS "Creators can view their own profile" ON public.creators;
CREATE POLICY "Creators can view their own profile"
  ON public.creators FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only update their OWN creator profile (already existed, keep it)
DROP POLICY IF EXISTS "Creators can update their own profile" ON public.creators;
CREATE POLICY "Creators can update their own profile"
  ON public.creators FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NO INSERT policy for authenticated users. All inserts go through
-- supabaseAdmin (service role) in server actions, which bypasses RLS.
-- This is intentional: creator registration is a privileged server-side operation.
-- If an INSERT policy for `authenticated` is ever needed, it must require
-- a verified=false check and be paired with a verification step.
