-- Run this in Supabase SQL Editor to create the daily_fortunes table
-- This table stores daily fortunes for users so they are persistent and sync across devices.

CREATE TABLE IF NOT EXISTS public.daily_fortunes (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    teller_id       text NOT NULL,           -- 'love' | 'finance' | 'work' | 'health' | 'overall'
    prediction      text NOT NULL,
    prediction_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at      timestamptz DEFAULT now(),
    UNIQUE(user_id, teller_id, prediction_date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_fortunes ENABLE ROW LEVEL SECURITY;

-- Allow logged-in users to insert their own predictions
CREATE POLICY "Users can insert own predictions"
    ON public.daily_fortunes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow logged-in users to read their own predictions only
CREATE POLICY "Users can read own predictions"
    ON public.daily_fortunes FOR SELECT
    USING (auth.uid() = user_id);
