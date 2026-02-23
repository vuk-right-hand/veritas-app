-- Migration: Add takeaways column to videos table
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/qopwhwpkjtjjlodaxoir/sql

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS takeaways text[] DEFAULT ARRAY[]::text[];
