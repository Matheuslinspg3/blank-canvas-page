-- Fix: restrict UPDATE on verification_codes to user_id = auth.uid() only
-- Previously allowed email = auth.email() which could enable bypass
DROP POLICY IF EXISTS "Users can update their own verification codes" ON public.verification_codes;

CREATE POLICY "Users can update their own verification codes"
ON public.verification_codes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());