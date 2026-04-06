
CREATE TABLE public.waiting_list (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_date date NOT NULL,
  time_slot time without time zone NOT NULL,
  barber_id uuid NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  status text NOT NULL DEFAULT 'pending',
  notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- Public can join waiting list
CREATE POLICY "Public can join waiting list"
ON public.waiting_list
FOR INSERT
TO public
WITH CHECK (
  client_name IS NOT NULL
  AND client_email IS NOT NULL
  AND appointment_date >= CURRENT_DATE
);

-- Public can read waiting list to check slot availability
CREATE POLICY "Public can read waiting list"
ON public.waiting_list
FOR SELECT
TO public
USING (true);

-- Admin can manage waiting list
CREATE POLICY "Admin manages waiting list"
ON public.waiting_list
FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Owner can manage waiting list
CREATE POLICY "Owner manages waiting list"
ON public.waiting_list
FOR ALL
TO authenticated
USING (get_barber_role(auth.uid()) = 'owner'::barber_role);

-- Barbers can update their own waiting list entries
CREATE POLICY "Barber updates own waiting list"
ON public.waiting_list
FOR UPDATE
TO authenticated
USING (barber_id = get_barber_id(auth.uid()));

-- Public can update waiting list (for accept/decline links)
CREATE POLICY "Public can update waiting list status"
ON public.waiting_list
FOR UPDATE
TO public
USING (true)
WITH CHECK (status IN ('accepted', 'declined', 'cancelled'));

-- Public can delete from waiting list
CREATE POLICY "Public can delete from waiting list"
ON public.waiting_list
FOR DELETE
TO public
USING (true);
