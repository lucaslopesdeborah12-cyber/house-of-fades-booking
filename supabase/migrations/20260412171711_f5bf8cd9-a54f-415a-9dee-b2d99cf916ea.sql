CREATE POLICY "Owner deletes any appointment"
ON public.appointments
FOR DELETE
TO authenticated
USING (get_barber_role(auth.uid()) = 'owner'::barber_role);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_break_per_day_idx
ON public.appointments (barber_id, appointment_date)
WHERE client_name = 'BREAK' AND status IN ('booked', 'confirmed');