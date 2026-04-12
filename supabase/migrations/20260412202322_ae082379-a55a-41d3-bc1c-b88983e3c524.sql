CREATE UNIQUE INDEX appointments_one_break_per_barber_day_idx 
ON public.appointments (barber_id, appointment_date) 
WHERE (client_name = 'BREAK' AND status IN ('booked', 'confirmed'));