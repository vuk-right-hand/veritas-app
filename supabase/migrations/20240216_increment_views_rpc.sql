-- Function to atomically increment video views
CREATE OR REPLACE FUNCTION increment_video_view(video_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE videos
  SET views_on_platform = COALESCE(views_on_platform, 0) + 1
  WHERE id = video_id_param;
END;
$$;
