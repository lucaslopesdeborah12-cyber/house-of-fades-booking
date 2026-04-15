import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShopSettings {
  last_working_day: "friday" | "saturday" | "sunday";
  default_break_time: string;
  work_start: string;
  work_end: string;
  owner_phone: string;
}

const DEFAULTS: ShopSettings = {
  last_working_day: "saturday",
  default_break_time: "13:00",
  work_start: "09:00",
  work_end: "19:00",
  owner_phone: "",
};

const KEYS = Object.keys(DEFAULTS) as (keyof ShopSettings)[];
const SHOP_SETTINGS_UPDATED_EVENT = "shop-settings-updated";

export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from("owner_settings")
      .select("key, value")
      .in("key", KEYS);

    const merged = { ...DEFAULTS };

    if (data) {
      data.forEach((row: any) => {
        if (KEYS.includes(row.key)) {
          (merged as any)[row.key] = row.value || (DEFAULTS as any)[row.key];
        }
      });
    }

    console.log("[ShopSettings] fetched settings:", merged);
    setSettings(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();

    const handleRefresh = () => {
      fetchSettings();
    };

    window.addEventListener(SHOP_SETTINGS_UPDATED_EVENT, handleRefresh);
    return () => window.removeEventListener(SHOP_SETTINGS_UPDATED_EVENT, handleRefresh);
  }, [fetchSettings]);

  const saveSetting = async (key: keyof ShopSettings, value: string) => {
    await (supabase.from("owner_settings" as any) as any).upsert(
      { key, value },
      { onConflict: "key" }
    );

    // When break time changes, update all future breaks in the database
    if (key === "default_break_time") {
      const { error } = await (supabase.rpc as any)("update_future_breaks", {
        p_new_time: value,
      });
      if (error) {
        console.error("[ShopSettings] Failed to update future breaks:", error);
      }
    }

    await fetchSettings();
    window.dispatchEvent(new CustomEvent(SHOP_SETTINGS_UPDATED_EVENT));
  };

  return { settings, loading, saveSetting, refetch: fetchSettings };
}

export function getDayCount(lastDay: string): number {
  switch (lastDay) {
    case "friday": return 5;
    case "saturday": return 6;
    case "sunday": return 7;
    default: return 6;
  }
}

export function generateTimeSlots(start: string, end: string): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + (em || 0);
  const slots: string[] = [];
  for (let m = startMin; m < endMin; m += 20) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}
