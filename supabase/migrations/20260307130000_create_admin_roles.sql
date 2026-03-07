-- Migration: Create Admin Roles Table and Enforce RLS
-- Description: Secures the /suggested-videos route using Identity-Based Access Control

CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own row (used by Layout check)
-- This extracts the email from the JWT via auth.jwt()
CREATE POLICY "Users can read their own admin role"
ON admin_roles
FOR SELECT
TO authenticated
USING (
    (auth.jwt() ->> 'email'::text) = email
);

-- Deny all other operations to general users. 
-- For now, adding admins is manual (via Superbase DB interface) or via service role.
