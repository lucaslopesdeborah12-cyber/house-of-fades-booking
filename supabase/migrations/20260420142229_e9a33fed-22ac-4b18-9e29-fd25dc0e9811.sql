CREATE TABLE public.shop_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week SMALLINT NOT NULL UNIQUE CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_open BOOLEAN NOT NULL DEFAULT true,
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '19:00',
  breaks JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shop schedule"
ON public.shop_schedule FOR SELECT
USING (true);

CREATE POLICY "Owner/admin can insert shop schedule"
ON public.shop_schedule FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()) OR get_barber_role(auth.uid()) = 'owner'::barber_role);

CREATE POLICY "Owner/admin can update shop schedule"
ON public.shop_schedule FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()) OR get_barber_role(auth.uid()) = 'owner'::barber_role);

CREATE POLICY "Owner/admin can delete shop schedule"
ON public.shop_schedule FOR DELETE
TO authenticated
USING (is_admin(auth.uid()) OR get_barber_role(auth.uid()) = 'owner'::barber_role);

CREATE TRIGGER update_shop_schedule_updated_at
BEFORE UPDATE ON public.shop_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed all 7 days using global owner_settings as fallback
INSERT INTO public.shop_schedule (day_of_week, is_open, open_time, close_time, breaks)
SELECT
  d AS day_of_week,
  CASE WHEN d = 0 THEN false ELSE true END AS is_open,
  COALESCE((SELECT value FROM public.owner_settings WHERE key = 'work_start'), '09:00')::time AS open_time,
  COALESCE((SELECT value FROM public.owner_settings WHERE key = 'work_end'), '19:00')::time AS close_time,
  '[]'::jsonb
FROM generate_series(0, 6) AS d;