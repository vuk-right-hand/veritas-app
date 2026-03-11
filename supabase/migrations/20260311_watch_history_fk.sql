-- Add FK so PostgREST can resolve watch_history → videos joins
ALTER TABLE public.watch_history
    ADD CONSTRAINT watch_history_video_id_fkey
    FOREIGN KEY (video_id) REFERENCES public.videos(id)
    ON DELETE CASCADE;
