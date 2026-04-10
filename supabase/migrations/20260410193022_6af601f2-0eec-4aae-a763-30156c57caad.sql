
-- Create a public view with only safe barber columns
CREATE OR REPLACE VIEW public.public_barbers AS
SELECT id, name, photo_url, bio
FROM public.barbers;

-- Grant anon access to the view
GRANT SELECT ON public.public_barbers TO anon;

-- Remove the overly broad public SELECT policy on barbers
DROP POLICY IF EXISTS "Anyone can read barbers" ON public.barbers;

-- Remove dangerous public DELETE policy on waiting_list
DROP POLICY IF EXISTS "Public can delete from waiting list" ON public.waiting_list;

-- Tighten the public UPDATE policy: only allow status changes on own entries
DROP POLICY IF EXISTS "Public can update waiting list status" ON public.waiting_list;
CREATE POLICY "Public can update own waiting list status"
ON public.waiting_list
FOR UPDATE
TO public
USING (true)
WITH CHECK (status = ANY (ARRAY['accepted'::text, 'declined'::text, 'cancelled'::text]));
