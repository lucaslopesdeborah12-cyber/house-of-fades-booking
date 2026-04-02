
-- Drop the overly permissive policy
DROP POLICY "Anyone can book appointments" ON public.appointments;

-- More restrictive: require valid barber_id and service_id exist
CREATE POLICY "Public can book appointments" ON public.appointments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.barbers WHERE id = barber_id)
    AND EXISTS (SELECT 1 FROM public.services WHERE id = service_id)
    AND client_name IS NOT NULL
    AND appointment_date >= CURRENT_DATE
  );
