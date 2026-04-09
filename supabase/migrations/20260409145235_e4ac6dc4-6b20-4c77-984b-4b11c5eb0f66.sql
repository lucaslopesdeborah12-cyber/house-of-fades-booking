
CREATE TABLE IF NOT EXISTS public.owner_settings (
  key text PRIMARY KEY,
  value text
);

ALTER TABLE public.owner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read owner settings"
ON public.owner_settings FOR SELECT
TO public
USING (true);

CREATE POLICY "Owner can upsert settings"
ON public.owner_settings FOR INSERT
TO authenticated
WITH CHECK (get_barber_role(auth.uid()) = 'owner' OR is_admin(auth.uid()));

CREATE POLICY "Owner can update settings"
ON public.owner_settings FOR UPDATE
TO authenticated
USING (get_barber_role(auth.uid()) = 'owner' OR is_admin(auth.uid()));
