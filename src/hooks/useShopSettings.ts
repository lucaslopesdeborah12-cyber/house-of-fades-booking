import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShopSettings {
  last_working_day: "friday" | "saturday" | "sunday";
  default_break_time: string;
  work_start: string;
  work_end: string;
}

const DEFAULTS: ShopSettings = {
  last_working_day: "saturday",
  default_break_time: "13:00",
  work_start: "09:00",
  work_end: "19:00",
};

const KEYS = Object.keys(DEFAULTS) as (keyof ShopSettings)[];

export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("owner_settings")
      .select("key, value")
      .in("key", KEYS);

    if (data) {
      const merged = { ...DEFAULTS };
      data.forEach((row: any) => {
        if (KEYS.includes(row.key)) {
          (merged as any)[row.key] = row.value || (DEFAULTS as any)[row.key];
        }
      });
      setSettings(merged);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSetting = async (key: keyof ShopSettings, value: string) => {
    await (supabase.from("owner_settings" as any) as any).upsert(
      { key, value },
      { onConflict: "key" }
    );
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, loading, saveSetting, refetch: fetchSettings };
}

/** How many days to show Mon=0..Sun=6 based on last working day */
export function getDayCount(lastDay: string): number {
  switch (lastDay) {
    case "friday": return 5;  // Mon–Fri
    case "saturday": return 6; // Mon–Sat
    case "sunday": return 7;   // Mon–Sun
    default: return 6;
  }
}

/** Generate time slots from start to end in 30min steps */
export function generateTimeSlots(start: string, end: string): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  const slots: string[] = [];
  for (let h = sh; h < eh; h++) {
    if (h === sh && sm === 30) {
      slots.push(`${String(h).padStart(2, "0")}:30`);
    } else {
      slots.push(`${String(h).padStart(2, "0")}:00`);
      slots.push(`${String(h).padStart(2, "0")}:30`);
    }
  }
  return slots;
}
