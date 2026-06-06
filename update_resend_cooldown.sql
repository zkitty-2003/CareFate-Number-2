-- ==============================================================
-- CareFate - Supabase Email Resend Cooldown Migration Script
-- Run this script in the Supabase SQL Editor (https://supabase.com)
-- ==============================================================

-- 1. Add cooldown columns to public.profiles table if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS resend_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_resend_allowed_time bigint DEFAULT 0;

-- 2. Create the RPC function with SECURITY DEFINER to check and update cooldown state
CREATE OR REPLACE FUNCTION public.check_and_update_resend_cooldown(input_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges to bypass RLS
AS $$
DECLARE
    user_rec RECORD;
    v_now bigint;
    v_cooldown_mins integer;
    v_next_allowed bigint;
    v_resend_count integer;
    v_diff_ms bigint;
BEGIN
    -- Get current time in milliseconds since epoch
    v_now := extract(epoch from now()) * 1000;

    -- Find the user in auth.users and profiles
    SELECT p.id, p.resend_count, p.next_resend_allowed_time
    INTO user_rec
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email = input_email;

    -- If no profile found (maybe table doesn't have it yet, let's create a best-effort check or insert it)
    IF user_rec.id IS NULL THEN
        -- Check if user exists in auth.users
        SELECT id INTO user_rec.id
        FROM auth.users
        WHERE email = input_email;
        
        IF user_rec.id IS NULL THEN
            -- User doesn't exist at all
            RETURN json_build_object(
                'status', 'error',
                'message', 'ไม่พบอีเมลนี้ในระบบ'
            );
        END IF;

        -- Create profile if missing
        INSERT INTO public.profiles (id, resend_count, next_resend_allowed_time)
        VALUES (user_rec.id, 0, 0)
        ON CONFLICT (id) DO NOTHING;
        
        user_rec.resend_count := 0;
        user_rec.next_resend_allowed_time := 0;
    END IF;

    -- Check if cooldown is active
    IF user_rec.next_resend_allowed_time IS NOT NULL AND v_now < user_rec.next_resend_allowed_time THEN
        v_diff_ms := user_rec.next_resend_allowed_time - v_now;
        RETURN json_build_object(
            'status', 'success',
            'allowed', false,
            'diff_ms', v_diff_ms,
            'resend_count', user_rec.resend_count
        );
    END IF;

    -- Update cooldown: increment count and set next time
    -- 1st resend: 5 mins, 2nd: 10 mins, 3rd: 20 mins, 4th: 40 mins...
    v_resend_count := COALESCE(user_rec.resend_count, 0) + 1;
    v_cooldown_mins := 5 * power(2, v_resend_count - 1);
    v_next_allowed := v_now + (v_cooldown_mins * 60 * 1000);

    UPDATE public.profiles
    SET resend_count = v_resend_count,
        next_resend_allowed_time = v_next_allowed
    WHERE id = user_rec.id;

    RETURN json_build_object(
        'status', 'success',
        'allowed', true,
        'resend_count', v_resend_count,
        'next_cooldown_mins', v_cooldown_mins
    );
END;
$$;

-- 3. Create RPC function to ROLLBACK cooldown if the resend API call fails (e.g. Supabase rate limits)
CREATE OR REPLACE FUNCTION public.rollback_resend_cooldown(input_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT p.id INTO v_user_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email = input_email;

    IF v_user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET resend_count = GREATEST(0, resend_count - 1),
            next_resend_allowed_time = 0
        WHERE id = v_user_id;
    END IF;
END;
$$;

-- 4. Create RPC function to check if an email exists and is verified (confirmed)
CREATE OR REPLACE FUNCTION public.check_email_verified(input_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges to access auth.users
AS $$
DECLARE
    v_confirmed boolean := false;
BEGIN
    -- Check if the email exists in auth.users and if it is confirmed
    SELECT (email_confirmed_at IS NOT NULL)
    INTO v_confirmed
    FROM auth.users
    WHERE email = input_email;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'exists', false,
            'verified', false
        );
    END IF;

    RETURN json_build_object(
        'exists', true,
        'verified', COALESCE(v_confirmed, false)
    );
END;
$$;
