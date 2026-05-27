-- Fix RLS Policy for teller_reviews table
-- Run this in Supabase SQL Editor

-- Drop the old broken SELECT policy
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.teller_reviews;

-- Create a new correct SELECT policy (allow all authenticated users to read)
CREATE POLICY "Authenticated users can read reviews"
    ON public.teller_reviews FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Also make sure the INSERT policy exists correctly
DROP POLICY IF EXISTS "Users can insert own reviews" ON public.teller_reviews;

CREATE POLICY "Users can insert own reviews"
    ON public.teller_reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);
