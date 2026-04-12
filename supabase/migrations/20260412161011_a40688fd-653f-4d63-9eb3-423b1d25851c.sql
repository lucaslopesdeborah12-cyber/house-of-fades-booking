ALTER TABLE public.booking_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.waiting_list
ADD COLUMN IF NOT EXISTS response_token uuid DEFAULT gen_random_uuid();

UPDATE public.waiting_list
SET response_token = gen_random_uuid()
WHERE response_token IS NULL;

ALTER TABLE public.waiting_list
ALTER COLUMN response_token SET NOT NULL;

DROP POLICY IF EXISTS "Public can update own waiting list status" ON public.waiting_list;

CREATE POLICY "Public can respond to waiting list with valid token"
ON public.waiting_list
FOR UPDATE
TO public
USING (true)
WITH CHECK (
  response_token IS NOT NULL
  AND status = ANY (ARRAY['accepted'::text, 'declined'::text, 'cancelled'::text])
);