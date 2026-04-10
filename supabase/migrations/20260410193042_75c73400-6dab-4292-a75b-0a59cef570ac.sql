
CREATE POLICY "Public can read barbers via view"
ON public.barbers
FOR SELECT
TO anon
USING (true);
