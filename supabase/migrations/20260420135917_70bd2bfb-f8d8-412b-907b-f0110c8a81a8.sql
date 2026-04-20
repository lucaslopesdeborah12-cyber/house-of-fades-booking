CREATE TABLE public.contact_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID,
  client_name TEXT,
  client_contact TEXT,
  method TEXT NOT NULL CHECK (method IN ('sms', 'email', 'call')),
  subject TEXT,
  message_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/admin select contact logs"
ON public.contact_logs FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.get_barber_role(auth.uid()) = 'owner');

CREATE POLICY "Owner/admin insert contact logs"
ON public.contact_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.get_barber_role(auth.uid()) = 'owner');

CREATE POLICY "Owner/admin update contact logs"
ON public.contact_logs FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR public.get_barber_role(auth.uid()) = 'owner');

CREATE INDEX idx_contact_logs_appointment ON public.contact_logs(appointment_id);
CREATE INDEX idx_contact_logs_created_at ON public.contact_logs(created_at DESC);