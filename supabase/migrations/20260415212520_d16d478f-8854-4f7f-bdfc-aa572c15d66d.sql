
CREATE OR REPLACE FUNCTION public.book_appointment_tx(
  p_barber_id uuid,
  p_service_id uuid,
  p_appointment_date date,
  p_time_slot time,
  p_client_name text,
  p_client_phone text DEFAULT NULL,
  p_client_email text DEFAULT NULL,
  p_contact_preference text DEFAULT 'sms'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Lock any existing rows for this slot to prevent race conditions
  SELECT id INTO v_existing_id
  FROM public.appointments
  WHERE barber_id = p_barber_id
    AND appointment_date = p_appointment_date
    AND time_slot = p_time_slot
    AND status IN ('booked', 'confirmed')
  FOR UPDATE;

  -- If slot is taken, raise error
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'slot_taken';
  END IF;

  -- Insert the new appointment
  INSERT INTO public.appointments (
    barber_id, service_id, appointment_date, time_slot,
    client_name, client_phone, client_email, contact_preference
  )
  VALUES (
    p_barber_id, p_service_id, p_appointment_date, p_time_slot,
    p_client_name, p_client_phone, p_client_email, p_contact_preference
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
