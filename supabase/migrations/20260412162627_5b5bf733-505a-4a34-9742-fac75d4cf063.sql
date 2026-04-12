
CREATE OR REPLACE FUNCTION public.update_future_breaks(p_new_time text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_break RECORD;
  v_new_slot time;
  v_candidate time;
  v_found boolean;
  v_hour int;
  v_min int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.is_admin(v_user_id) OR public.get_barber_role(v_user_id) = 'owner') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  v_new_slot := (p_new_time || ':00')::time;

  FOR v_break IN
    SELECT id, barber_id, appointment_date, time_slot
    FROM public.appointments
    WHERE client_name = 'BREAK'
      AND status = 'booked'
      AND appointment_date >= CURRENT_DATE
  LOOP
    -- Skip if already at the desired time
    IF v_break.time_slot = v_new_slot THEN
      CONTINUE;
    END IF;

    -- Check if new slot is free for this barber on this day
    IF NOT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE barber_id = v_break.barber_id
        AND appointment_date = v_break.appointment_date
        AND time_slot = v_new_slot
        AND status IN ('booked', 'confirmed')
        AND id <> v_break.id
    ) THEN
      -- Move break to desired time
      UPDATE public.appointments
      SET time_slot = v_new_slot
      WHERE id = v_break.id;
    ELSE
      -- Find next free 30-min slot (09:00 to 19:00)
      v_found := false;
      v_hour := 9;
      v_min := 0;
      WHILE v_hour < 19 AND NOT v_found LOOP
        v_candidate := make_time(v_hour, v_min, 0);
        IF NOT EXISTS (
          SELECT 1 FROM public.appointments
          WHERE barber_id = v_break.barber_id
            AND appointment_date = v_break.appointment_date
            AND time_slot = v_candidate
            AND status IN ('booked', 'confirmed')
            AND id <> v_break.id
        ) THEN
          UPDATE public.appointments
          SET time_slot = v_candidate
          WHERE id = v_break.id;
          v_found := true;
        END IF;
        -- Next 30 min
        v_min := v_min + 30;
        IF v_min >= 60 THEN
          v_min := 0;
          v_hour := v_hour + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.update_future_breaks(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_future_breaks(text) TO authenticated;
