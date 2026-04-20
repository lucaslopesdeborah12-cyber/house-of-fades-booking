import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShopBreak {
  start: string; // "HH:MM"
  end: string;
}

export interface DaySchedule {
  day_of_week: number; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  is_open: boolean;
  open_time: string; // "HH:MM"
  close_time: string;
  breaks: ShopBreak[];
}

const SHOP_SCHEDULE_UPDATED_EVENT = "shop-schedule-updated";

const trimTime = (t: string) => (t ? t.slice(0, 5) : t);

export function useShopSchedule() {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("shop_schedule" as any) as any)
      .select("day_of_week, is_open, open_time, close_time, breaks")
      .order("day_of_week");
    if (error) {
      console.error("[useShopSchedule] fetch error", error);
      setSchedule([]);
    } else {
      const normalized: DaySchedule[] = (data || []).map((d: any) => ({
        day_of_week: d.day_of_week,
        is_open: d.is_open,
        open_time: trimTime(d.open_time),
        close_time: trimTime(d.close_time),
        breaks: Array.isArray(d.breaks)
          ? d.breaks.map((b: any) => ({ start: trimTime(b.start), end: trimTime(b.end) }))
          : [],
      }));
      setSchedule(normalized);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSchedule();
    const handler = () => fetchSchedule();
    window.addEventListener(SHOP_SCHEDULE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(SHOP_SCHEDULE_UPDATED_EVENT, handler);
  }, [fetchSchedule]);

  const saveSchedule = useCallback(async (next: DaySchedule[]) => {
    const rows = next.map((d) => ({
      day_of_week: d.day_of_week,
      is_open: d.is_open,
      open_time: d.open_time.length === 5 ? `${d.open_time}:00` : d.open_time,
      close_time: d.close_time.length === 5 ? `${d.close_time}:00` : d.close_time,
      breaks: d.breaks,
    }));
    const { error } = await (supabase.from("shop_schedule" as any) as any).upsert(rows, {
      onConflict: "day_of_week",
    });
    if (error) throw error;
    await fetchSchedule();
    window.dispatchEvent(new CustomEvent(SHOP_SCHEDULE_UPDATED_EVENT));
  }, [fetchSchedule]);

  return { schedule, loading, saveSchedule, refetch: fetchSchedule };
}

/** Returns the day schedule for a given JS Date (date.getDay() => 0..6) */
export function getDayScheduleFor(schedule: DaySchedule[], date: Date): DaySchedule | null {
  const dow = date.getDay();
  return schedule.find((d) => d.day_of_week === dow) || null;
}

/** Whether a "HH:MM" slot falls inside any break window (start inclusive, end exclusive) */
export function isSlotInBreaks(slot: string, breaks: ShopBreak[]): boolean {
  const [sh, sm] = slot.split(":").map(Number);
  const slotMin = sh * 60 + sm;
  return breaks.some((b) => {
    const [bh, bm] = b.start.split(":").map(Number);
    const [eh, em] = b.end.split(":").map(Number);
    const bs = bh * 60 + bm;
    const be = eh * 60 + em;
    return slotMin >= bs && slotMin < be;
  });
}

/** Whether a slot is within open/close hours (close exclusive) */
export function isSlotWithinHours(slot: string, open: string, close: string): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s = toMin(slot);
  return s >= toMin(open) && s < toMin(close);
}