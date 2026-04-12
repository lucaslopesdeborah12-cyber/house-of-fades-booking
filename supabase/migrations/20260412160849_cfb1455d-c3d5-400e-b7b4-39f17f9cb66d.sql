DELETE FROM public.appointments WHERE client_name = 'BREAK';

DROP INDEX IF EXISTS appointments_one_booked_break_per_day_idx;
CREATE UNIQUE INDEX appointments_one_booked_break_per_day_idx
ON public.appointments (barber_id, appointment_date)
WHERE client_name = 'BREAK' AND status = 'booked';

CREATE OR REPLACE FUNCTION public.move_daily_break(
  p_break_id uuid,
  p_barber_id uuid,
  p_appointment_date date,
  p_new_time_slot time
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_owner boolean := false;
  v_is_same_barber boolean := false;
  v_break public.appointments;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_is_admin := public.is_admin(v_user_id);
  v_is_owner := public.get_barber_role(v_user_id) = 'owner';
  v_is_same_barber := public.get_barber_id(v_user_id) = p_barber_id;

  IF NOT (v_is_admin OR v_is_owner OR v_is_same_barber) THEN
    RAISE EXCEPTION 'Not allowed to move this break';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE barber_id = p_barber_id
      AND appointment_date = p_appointment_date
      AND time_slot = p_new_time_slot
      AND status IN ('booked', 'confirmed')
      AND id <> p_break_id
  ) THEN
    RAISE EXCEPTION 'Selected time slot is not free';
  END IF;

  DELETE FROM public.appointments
  WHERE id = p_break_id
    AND barber_id = p_barber_id
    AND appointment_date = p_appointment_date
    AND client_name = 'BREAK'
    AND status = 'booked';

  INSERT INTO public.appointments (
    barber_id,
    appointment_date,
    time_slot,
    client_name,
    status,
    client_phone,
    client_email,
    service_id
  )
  VALUES (
    p_barber_id,
    p_appointment_date,
    p_new_time_slot,
    'BREAK',
    'booked',
    NULL,
    NULL,
    NULL
  )
  RETURNING * INTO v_break;

  RETURN v_break;
END;
$$;

REVOKE ALL ON FUNCTION public.move_daily_break(uuid, uuid, date, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_daily_break(uuid, uuid, date, time) TO authenticated;