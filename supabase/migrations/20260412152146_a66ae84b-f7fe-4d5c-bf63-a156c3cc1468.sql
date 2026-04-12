-- Allow barbers to insert their own appointments (for BREAK slots etc.)
CREATE POLICY "Barbers insert own appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (barber_id = get_barber_id(auth.uid()));

-- Allow barbers to delete their own appointments
CREATE POLICY "Barbers delete own appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (barber_id = get_barber_id(auth.uid()));