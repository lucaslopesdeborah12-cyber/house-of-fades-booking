
-- Create barber role enum
CREATE TYPE public.barber_role AS ENUM ('owner', 'employee');

-- Create barbers table
CREATE TABLE public.barbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role barber_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

-- Security definer function to get barber role without recursion
CREATE OR REPLACE FUNCTION public.get_barber_role(_user_id UUID)
RETURNS barber_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.barbers WHERE user_id = _user_id LIMIT 1;
$$;

-- Security definer to get barber id
CREATE OR REPLACE FUNCTION public.get_barber_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.barbers WHERE user_id = _user_id LIMIT 1;
$$;

-- Barbers RLS: owner sees all, employee sees own
CREATE POLICY "Owner sees all barbers" ON public.barbers
  FOR SELECT TO authenticated
  USING (public.get_barber_role(auth.uid()) = 'owner');

CREATE POLICY "Employee sees own barber record" ON public.barbers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Create services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read services" ON public.services
  FOR SELECT USING (true);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  appointment_date DATE NOT NULL,
  time_slot TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'no-show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Owner sees all appointments
CREATE POLICY "Owner sees all appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (public.get_barber_role(auth.uid()) = 'owner');

-- Employee sees own appointments
CREATE POLICY "Employee sees own appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (barber_id = public.get_barber_id(auth.uid()));

-- Barbers can update appointment status
CREATE POLICY "Barbers update own appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (barber_id = public.get_barber_id(auth.uid()));

-- Owner can update any appointment
CREATE POLICY "Owner updates any appointment" ON public.appointments
  FOR UPDATE TO authenticated
  USING (public.get_barber_role(auth.uid()) = 'owner');

-- Anyone can insert appointments (for booking)
CREATE POLICY "Anyone can book appointments" ON public.appointments
  FOR INSERT WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed services
INSERT INTO public.services (name, duration_minutes, price) VALUES
  ('Haircut', 20, 22.00),
  ('Skin Fade', 20, 24.00),
  ('Hot Towel Shave', 20, 25.00),
  ('Beard Trim', 20, 12.00),
  ('Haircut & Beard Trim', 20, 29.00),
  ('Skin Fade & Beard Trim', 20, 32.00),
  ('Haircut & Hot Towel Shave', 40, 40.00),
  ('Kids Cut Under 12', 20, 20.00),
  ('Student Skin Fade', 20, 20.00),
  ('OAP Special', 20, 15.00);
