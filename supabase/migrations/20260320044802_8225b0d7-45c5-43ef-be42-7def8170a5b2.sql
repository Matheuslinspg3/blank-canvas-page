-- Fix remaining NULL string columns causing GoTrueAuth scan errors
UPDATE auth.users SET email_change = '' WHERE email_change IS NULL;
UPDATE auth.users SET phone_change = '' WHERE phone_change IS NULL;