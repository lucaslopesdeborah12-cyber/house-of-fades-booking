DROP POLICY IF EXISTS "Admins manage booking attempts" ON public.booking_attempts;
CREATE POLICY "Admins manage booking attempts"
ON public.booking_attempts
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can respond to waiting list with valid token" ON public.waiting_list;
CREATE POLICY "Public can respond to waiting list while pending"
ON public.waiting_list
FOR UPDATE
TO public
USING (
  status = 'pending'
  AND response_token IS NOT NULL
)
WITH CHECK (
  response_token IS NOT NULL
  AND status = ANY (ARRAY['accepted'::text, 'declined'::text, 'cancelled'::text])
);