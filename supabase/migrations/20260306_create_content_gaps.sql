-- Zero-State Search: content_gaps table
-- Logs user searches that returned no pgvector matches, turning them into priority content requests.

CREATE TABLE content_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dedup index: prevent same user logging same query twice
CREATE INDEX idx_content_gaps_user_query ON content_gaps (user_id, search_query);

-- Admin analytics: filter by status
CREATE INDEX idx_content_gaps_status ON content_gaps (status);

ALTER TABLE content_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own content gaps"
  ON content_gaps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own content gaps"
  ON content_gaps FOR SELECT TO authenticated
  USING (user_id = auth.uid());
