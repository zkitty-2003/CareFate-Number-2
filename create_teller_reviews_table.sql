-- Run this in Supabase SQL Editor to create the teller_reviews table

CREATE TABLE IF NOT EXISTS public.teller_reviews (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    teller_id   text NOT NULL,           -- 'love' | 'finance' | 'work' | 'health' | 'overall'
    rating      smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback    text,
    created_at  timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.teller_reviews ENABLE ROW LEVEL SECURITY;

-- Allow logged-in users to insert their own reviews
CREATE POLICY "Users can insert own reviews"
    ON public.teller_reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow anyone (logged in) to read all reviews (for avg calc)
CREATE POLICY "Anyone can read reviews"
    ON public.teller_reviews FOR SELECT
    USING (auth.role() = 'authenticated');
