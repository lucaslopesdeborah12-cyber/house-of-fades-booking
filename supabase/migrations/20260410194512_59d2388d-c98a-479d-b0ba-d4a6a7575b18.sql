DROP POLICY IF EXISTS "Public can read barbers via view" ON public.barbers;

CREATE POLICY "Public can read barbers"
ON public.barbers
FOR SELECT
TO public
USING (true);