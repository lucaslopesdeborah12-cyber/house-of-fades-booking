ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_notified boolean NOT NULL DEFAULT false;