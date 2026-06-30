import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Plus, X, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useShopSchedule, type DaySchedule } from "@/hooks/useShopSchedule";
import { useShopSettings, type ShopSettings } from "@/hooks/useShopSettings";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";

const GOLD = "#c9a84c";

// Mon-first display order, mapped to JS getDay() (0=Sun)
const DAY_ORDER: { dow: number; key: string }[] = [
  { dow: 1, key: "mon" },
  { dow: 2, key: "tue" },
  { dow: 3, key: "wed" },
  { dow: 4, key: "thu" },
  { dow: 5, key: "fri" },
  { dow: 6, key: "sat" },
  { dow: 0, key: "sun" },
];

const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 12,
};

const inputStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #2e2e2e",
  borderRadius: 8,
  color: "#fff",
  padding: "8px 10px",
  fontSize: 13,
  colorScheme: "dark",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: GOLD,
  marginBottom: 10,
  fontWeight: 500,
};

const TimeInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <input
    type="time"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={inputStyle}
    onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
    onBlur={(e) => (e.currentTarget.style.borderColor = "#2e2e2e")}
    className="font-body"
  />
);

const ToggleSwitch = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
    style={{ background: on ? GOLD : "#2a2a2a" }}
    aria-pressed={on}
  >
    <span
      className="inline-block h-4 w-4 transform rounded-full transition-transform"
      style={{
        background: on ? "#111" : "#666",
        transform: on ? "translateX(24px)" : "translateX(4px)",
      }}
    />
  </button>
);

const ShopSettingsPanel = () => {
  const { t } = useLanguage();
  const { schedule, saveSchedule, loading } = useShopSchedule();
  const { settings, saveSetting } = useShopSettings();

  const [draft, setDraft] = useState<DaySchedule[]>([]);
  const [globalBreak, setGlobalBreak] = useState({ start: "12:00", end: "13:00" });
  const [ownerPhone, setOwnerPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<{ open: boolean; affected: string[] } | null>(null);

  // Sync draft from server data
  useEffect(() => {
    if (!loading) {
      const ordered = DAY_ORDER.map(({ dow }) => {
        const found = schedule.find((d) => d.day_of_week === dow);
        return (
          found || {
            day_of_week: dow,
            is_open: dow !== 0,
            open_time: "09:00",
            close_time: "19:00",
            breaks: [],
          }
        );
      });
      setDraft(ordered);
    }
  }, [schedule, loading]);

  useEffect(() => {
    setOwnerPhone(settings.owner_phone || "");
  }, [settings.owner_phone]);

  const updateDay = (dow: number, patch: Partial<DaySchedule>) => {
    setDraft((prev) => prev.map((d) => (d.day_of_week === dow ? { ...d, ...patch } : d)));
  };

  const addBreak = (dow: number) => {
    updateDay(dow, {
      breaks: [
        ...(draft.find((d) => d.day_of_week === dow)?.breaks || []),
        { start: "12:00", end: "13:00" },
      ].sort((a, b) => a.start.localeCompare(b.start)),
    });
  };

  const removeBreak = (dow: number, idx: number) => {
    const day = draft.find((d) => d.day_of_week === dow);
    if (!day) return;
    updateDay(dow, { breaks: day.breaks.filter((_, i) => i !== idx) });
  };

  const updateBreak = (dow: number, idx: number, patch: Partial<{ start: string; end: string }>) => {
    const day = draft.find((d) => d.day_of_week === dow);
    if (!day) return;
    const next = day.breaks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    updateDay(dow, { breaks: next });
  };

  const applyGlobalBreak = () => {
    if (globalBreak.end <= globalBreak.start) {
      toast.error(t("shop.invalidGlobal"));
      return;
    }
    setDraft((prev) =>
      prev.map((d) =>
        d.is_open
          ? {
              ...d,
              breaks: [...d.breaks, { ...globalBreak }].sort((a, b) =>
                a.start.localeCompare(b.start),
              ),
            }
          : d,
      ),
    );
    toast.success(t("shop.appliedAll"));
  };

  const validate = (): string | null => {
    for (const d of draft) {
      if (!d.is_open) continue;
      if (d.close_time <= d.open_time) {
        const meta = DAY_ORDER.find((x) => x.dow === d.day_of_week);
        const lbl = meta ? t(`shop.day.${meta.key}.full`) : "";
        return t("shop.errInvalidHours").replace("{day}", lbl);
      }
      for (const b of d.breaks) {
        if (b.end <= b.start) {
          const meta = DAY_ORDER.find((x) => x.dow === d.day_of_week);
          const lbl = meta ? t(`shop.day.${meta.key}.full`) : "";
          return t("shop.errInvalidBreak").replace("{day}", lbl);
        }
      }
    }
    return null;
  };

  const findFutureAffectedDays = async (): Promise<string[]> => {
    // Days that were ON before, now OFF
    const newlyClosed = draft
      .filter((d) => !d.is_open && schedule.find((s) => s.day_of_week === d.day_of_week)?.is_open)
      .map((d) => d.day_of_week);
    if (newlyClosed.length === 0) return [];

    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    const horizon = format(addDays(new Date(), 60), "yyyy-MM-dd");
    const { data } = await supabase
      .from("appointments")
      .select("appointment_date, time_slot, client_name")
      .gte("appointment_date", today)
      .lte("appointment_date", horizon)
      .in("status", ["booked", "confirmed"])
      .neq("client_name", "BREAK")
      .neq("client_name", "DAYOFF");
    if (!data) return [];
    const affected = data
      .filter((a) => newlyClosed.includes(new Date(a.appointment_date + "T00:00:00").getDay()))
      .map((a) => `${a.appointment_date} ${t("shop.at")} ${a.time_slot.slice(0, 5)} — ${a.client_name}`);
    return affected;
  };

  const doSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      await saveSchedule(draft);
      if (ownerPhone !== (settings.owner_phone || "")) {
        await saveSetting("owner_phone" as keyof ShopSettings, ownerPhone);
      }
      toast.success(t("shop.saved"));
    } catch (e: any) {
      console.error(e);
      toast.error(t("shop.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const affected = await findFutureAffectedDays();
    if (affected.length > 0) {
      setConfirmState({ open: true, affected });
      return;
    }
    await doSave();
  };

  return (
    <div className="p-4" style={cardStyle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-serif text-lg font-semibold text-white">{t("shop.title")}</h3>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="font-body text-xs font-medium uppercase tracking-wider px-5 py-2.5 transition-opacity disabled:opacity-40"
          style={{ background: GOLD, color: "#111", borderRadius: 8 }}
        >
          {saving ? t("shop.saving") : t("shop.saveChanges")}
        </button>
      </div>

      {/* WEEKLY SCHEDULE */}
      <p style={sectionLabelStyle}>{t("shop.weeklySchedule")}</p>

      {/* Day pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DAY_ORDER.map(({ dow, key }) => {
          const day = draft.find((d) => d.day_of_week === dow);
          const on = !!day?.is_open;
          return (
            <button
              key={dow}
              onClick={() => day && updateDay(dow, { is_open: !on })}
              className="font-body text-xs uppercase tracking-wider px-3.5 py-1.5 transition-all"
              style={{
                background: on ? GOLD : "#1a1a1a",
                color: on ? "#111" : "#555",
                border: `1px solid ${on ? GOLD : "#2a2a2a"}`,
                borderRadius: 999,
                textDecoration: on ? "none" : "line-through",
              }}
            >
              {t(`shop.day.${key}.short`)}
            </button>
          );
        })}
      </div>

      {/* Per-day cards */}
      <div className="space-y-3 mb-6">
        {draft.map((day) => {
          const meta = DAY_ORDER.find((x) => x.dow === day.day_of_week)!;
          return (
            <motion.div
              key={day.day_of_week}
              animate={{ opacity: day.is_open ? 1 : 0.5 }}
              transition={{ duration: 0.2 }}
              className="p-4"
              style={cardStyle}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm text-white">{t(`shop.day.${meta.key}.full`)}</span>
                  {!day.is_open && (
                    <span
                      className="font-body text-[10px] uppercase tracking-wider px-2 py-0.5"
                      style={{ background: "#2a2a2a", color: "#888", borderRadius: 4 }}
                    >
                      {t("shop.closed")}
                    </span>
                  )}
                </div>
                <ToggleSwitch on={day.is_open} onChange={(v) => updateDay(day.day_of_week, { is_open: v })} />
              </div>

              <AnimatePresence initial={false}>
                {day.is_open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="grid grid-cols-2 gap-3 mb-4 pt-1">
                      <div>
                        <label className="font-body text-[10px] uppercase tracking-wider text-white/50 block mb-1.5">
                          {t("shop.opening")}
                        </label>
                        <TimeInput
                          value={day.open_time}
                          onChange={(v) => updateDay(day.day_of_week, { open_time: v })}
                        />
                      </div>
                      <div>
                        <label className="font-body text-[10px] uppercase tracking-wider text-white/50 block mb-1.5">
                          {t("shop.closing")}
                        </label>
                        <TimeInput
                          value={day.close_time}
                          onChange={(v) => updateDay(day.day_of_week, { close_time: v })}
                        />
                      </div>
                    </div>

                    <p style={{ ...sectionLabelStyle, marginBottom: 6 }}>{t("shop.breaks")}</p>
                    <div className="space-y-2">
                      {day.breaks.length === 0 && (
                        <p className="font-body text-xs text-white/40 italic">{t("shop.noBreaks")}</p>
                      )}
                      {day.breaks.map((b, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <TimeInput
                            value={b.start}
                            onChange={(v) => updateBreak(day.day_of_week, i, { start: v })}
                          />
                          <span className="text-white/40">→</span>
                          <TimeInput
                            value={b.end}
                            onChange={(v) => updateBreak(day.day_of_week, i, { end: v })}
                          />
                          <button
                            onClick={() => removeBreak(day.day_of_week, i)}
                            className="ml-auto font-body text-xs text-white/40 hover:text-[#e24b4a] transition-colors flex items-center gap-1"
                          >
                            <X className="h-3.5 w-3.5" /> {t("shop.remove")}
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addBreak(day.day_of_week)}
                        className="w-full font-body text-xs uppercase tracking-wider py-2 transition-colors flex items-center justify-center gap-1.5"
                        style={{
                          color: GOLD,
                          border: `1px dashed ${GOLD}66`,
                          borderRadius: 8,
                          background: "transparent",
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> {t("shop.addBreak")}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* GLOBAL BREAK */}
      <p style={sectionLabelStyle}>{t("shop.globalBreak")}</p>
      <div className="p-4 mb-6" style={cardStyle}>
        <div className="flex flex-wrap items-center gap-2">
          <TimeInput value={globalBreak.start} onChange={(v) => setGlobalBreak((p) => ({ ...p, start: v }))} />
          <span className="text-white/40">→</span>
          <TimeInput value={globalBreak.end} onChange={(v) => setGlobalBreak((p) => ({ ...p, end: v }))} />
          <button
            onClick={applyGlobalBreak}
            className="ml-auto font-body text-xs uppercase tracking-wider px-4 py-2 transition-colors"
            style={{
              color: GOLD,
              border: `1px solid ${GOLD}`,
              borderRadius: 8,
              background: "transparent",
            }}
          >
            {t("shop.applyAllOpen")}
          </button>
        </div>
      </div>

      {/* OWNER PHONE */}
      <p style={sectionLabelStyle}>{t("shop.ownerPhone")}</p>
      <div className="p-4" style={cardStyle}>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" style={{ color: GOLD }} />
          <Input
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            placeholder="+353 8X XXX XXXX"
            className="border text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
            style={{ background: "#111", borderColor: "#2e2e2e", borderRadius: 8 }}
          />
        </div>
      </div>

      <AlertDialog
        open={!!confirmState?.open}
        onOpenChange={(o) => !o && setConfirmState(null)}
      >
        <AlertDialogContent style={{ background: "#111", borderColor: "#2a2a2a", color: "#fff" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: GOLD }}>{t("shop.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              {t("shop.confirmDescPrefix")} {confirmState?.affected.length} {t("shop.confirmDescSuffix")}
              <div className="mt-3 max-h-40 overflow-y-auto text-xs space-y-1 text-white/50">
                {confirmState?.affected.slice(0, 20).map((s, i) => <div key={i}>• {s}</div>)}
                {(confirmState?.affected.length || 0) > 20 && <div>{t("shop.andMore")}</div>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#fff" }}>
              {t("shop.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmState(null);
                await doSave();
              }}
              style={{ background: GOLD, color: "#111" }}
            >
              {t("shop.confirmSave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShopSettingsPanel;
