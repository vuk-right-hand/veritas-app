-- Add user_id to feature_requests
ALTER TABLE public.feature_requests 
ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add user_id to comments
ALTER TABLE public.comments 
ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
