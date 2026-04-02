
-- Admin users table
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Security definer function for admin check
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id);
$$;

-- Admin can read own record
CREATE POLICY "Admin sees own record" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Add columns to barbers
ALTER TABLE public.barbers
  ADD COLUMN commission_rate NUMERIC(4,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN photo_url TEXT,
  ADD COLUMN bio TEXT;

-- Admin policies for barbers
CREATE POLICY "Admin can insert barbers" ON public.barbers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update barbers" ON public.barbers
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete barbers" ON public.barbers
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin can see all barbers
CREATE POLICY "Admin sees all barbers" ON public.barbers
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin policies for appointments
CREATE POLICY "Admin sees all appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin updates any appointment" ON public.appointments
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin deletes any appointment" ON public.appointments
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin inserts appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin policies for services
CREATE POLICY "Admin can insert services" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update services" ON public.services
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete services" ON public.services
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Admin can insert reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update reviews" ON public.reviews
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete reviews" ON public.reviews
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Site content key-value table
CREATE TABLE public.site_content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site content" ON public.site_content
  FOR SELECT USING (true);

CREATE POLICY "Admin can insert site content" ON public.site_content
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update site content" ON public.site_content
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Timestamp trigger for site_content
CREATE TRIGGER update_site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for site assets
INSERT INTO storage.buckets (id, name, public) VALUES ('site-assets', 'site-assets', true);

CREATE POLICY "Anyone can view site assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-assets');

CREATE POLICY "Admin can upload site assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete site assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

-- Seed default site content
INSERT INTO public.site_content (key, value) VALUES
  ('hero', '{"tagline": "Premium cuts. No compromises.", "buttonText": "Book Now", "buttonColor": "#8B1A1A", "heroImageUrl": "", "logoUrl": ""}'),
  ('about', '{"text": "It''s a beautiful thing when a career and a passion come together. House of Fades has been serving Carlow since 2025. We believe every man deserves to look and feel his best. Our team of skilled barbers brings precision, style, and a genuine love for the craft to every appointment."}'),
  ('hours', '[{"day": "Monday", "time": "Closed"}, {"day": "Tuesday", "time": "09:00 – 18:00"}, {"day": "Wednesday", "time": "09:00 – 18:00"}, {"day": "Thursday", "time": "09:00 – 17:00"}, {"day": "Friday", "time": "09:00 – 18:00"}, {"day": "Saturday", "time": "09:00 – 17:00"}, {"day": "Sunday", "time": "Closed"}]'),
  ('contact', '{"address": "153 Green Ln, Carlow, R93 W354", "phone": "", "email": ""}'),
  ('footer', '{"text": "EST. 2025 — Carlow, Ireland", "instagram": "", "facebook": "", "phone": ""}'),
  ('design', '{"font": "Playfair Display", "primaryColor": "#8B1A1A", "accentColor": "#4A7C2F", "backgroundColor": "#1a1a1a", "textColor": "#F5F5F5"}');

-- Seed default reviews
INSERT INTO public.reviews (author, text, rating) VALUES
  ('Sean M.', 'Would highly recommend the lads. They have great patience with my young lad.', 5),
  ('Darren K.', 'Best barbershop in Carlow by a mile. Always leave looking sharp.', 5),
  ('Conor O''B.', 'Unreal skin fade every single time. The lads know their craft inside out.', 5),
  ('James P.', 'Brilliant atmosphere and top-class service. Wouldn''t go anywhere else.', 5);
