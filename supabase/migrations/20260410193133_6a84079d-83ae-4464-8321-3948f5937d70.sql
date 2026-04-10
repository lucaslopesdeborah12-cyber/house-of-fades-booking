
CREATE TABLE public.booking_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  client_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed - only accessed by service role in edge function
ALTER TABLE public.booking_attempts ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup old entries (keep 24h)
CREATE INDEX idx_booking_attempts_created ON public.booking_attempts(created_at);
CREATE INDEX idx_booking_attempts_ip ON public.booking_attempts(ip_address, created_at);
