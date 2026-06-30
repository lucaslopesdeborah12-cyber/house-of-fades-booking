import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  format,
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  parseISO,
  isBefore,
  isToday,
  isAfter,
  startOfDay,
} from "date-fns";
import { Check, X, Ban, Coffee, ChevronLeft, ChevronRight, Clock, CalendarDays, Phone, Mail, Scissors, Plus, CalendarOff, Trash2, ArrowRight } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { notifyWaitingList } from "@/lib/waitingListNotifier";
import { useShopSettings, getDayCount, generateTimeSlots } from "@/hooks/useShopSettings";
import MySchedulePanel from "@/components/barber/MySchedulePanel";
import { useLanguage } from "@/i18n/LanguageContext";

type Appointment = Tables<"appointments"> & {
  services: { name: string; price: number } | null;
  barbers: { name: string } | null;
};

const GOLD = "#c9a84c";
const RED = "#ff4444";

type ModalType = "booked" | "free" | "break" | "blocked" | "move" | "block-range" | null;

const ScheduleTab = ({ barberId, activeTab, refreshToken }: { barberId: string; activeTab?: string; refreshToken?: number }) => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<"appointments" | "schedule">("appointments");
  const { settings, loading: settingsLoading, refetch: refetchSettings } = useShopSettings();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const breakCheckedRef = useRef<string>("");

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalAppt, setModalAppt] = useState<Appointment | null>(null);
  const [modalTime, setModalTime] = useState("");
  const [moveTarget, setMoveTarget] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");

  const dayCount = getDayCount(settings.last_working_day);
  const timeSlots = generateTimeSlots(settings.work_start, settings.work_end);
  const dayNames = [0,1,2,3,4,5,6].map(i => t(`schedule.dayShort${i}`)).slice(0, dayCount);
  const defaultBreakTime = settings.default_break_time;
  const weekDays = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const selectedDate = weekDays[selectedDay] || weekDays[0];
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  const dayAppointments = appointments.filter(a => a.appointment_date === selectedDateStr);
  const isDayOff = dayAppointments.some(a => a.client_name === "DAYOFF");
  const occupiedSlots = dayAppointments.map(a => a.time_slot.slice(0, 5));
  const freeSlots = timeSlots.filter(t => !occupiedSlots.includes(t) && !isPastStatic(selectedDateStr, t));

  // --- Data fetching ---
  useEffect(() => {
    if (settingsLoading) return;
    const today = new Date();
    const lastDay = addDays(weekStart, dayCount - 1);
    lastDay.setHours(23, 59, 59, 999);
    if (isAfter(today, lastDay)) setWeekStart(addWeeks(weekStart, 1));
  }, [settingsLoading, weekStart, dayCount]);

  useEffect(() => {
    const todayIndex = weekDays.findIndex((day) => isToday(day));
    setSelectedDay(todayIndex >= 0 ? todayIndex : 0);
  }, [weekStart, dayCount]);

  const fetchAppointments = useCallback(async () => {
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addDays(weekStart, dayCount - 1), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("appointments")
      .select("id, appointment_date, barber_id, client_email, client_name, client_phone, contact_preference, created_at, notes, service_id, status, time_slot, updated_at, services(name, price), barbers(name)")
      .eq("barber_id", barberId)
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .in("status", ["booked", "confirmed"])
      .order("appointment_date")
      .order("time_slot");
    if (error) toast.error(t("schedule.toastFailedLoad"));
    else setAppointments((data || []) as Appointment[]);
    setLoading(false);
  }, [barberId, weekStart, dayCount]);

  useEffect(() => { setLoading(true); fetchAppointments(); }, [fetchAppointments]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`schedule-${barberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `barber_id=eq.${barberId}` }, () => fetchAppointments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [barberId, fetchAppointments]);

  const forceRefresh = useCallback(() => {
    setLoading(true);
    breakCheckedRef.current = "";
    refetchSettings();
    fetchAppointments();
  }, [fetchAppointments, refetchSettings]);

  useEffect(() => { if (activeTab === "schedule") forceRefresh(); }, [activeTab, refreshToken, forceRefresh]);
  useEffect(() => { breakCheckedRef.current = ""; }, [selectedDateStr, barberId]);

  // Auto-insert default break
  const insertDefaultBreak = useCallback(async () => {
    const { data: services, error: serviceError } = await supabase
      .from("services")
      .select("id")
      .limit(1);

    if (serviceError || !services?.length) {
      console.error("Failed to load service for break:", serviceError);
      toast.error(t("schedule.toastFailedBreak"));
      return false;
    }

    const breakInsert = {
      barber_id: barberId,
      service_id: services[0].id,
      appointment_date: selectedDateStr,
      time_slot: `${defaultBreakTime}:00`,
      client_name: "BREAK",
      client_phone: null,
      client_email: null,
      contact_preference: "both",
      status: "booked",
    };

    console.log("Default break insert payload:", breakInsert);
    const { error } = await supabase.from("appointments").insert(breakInsert);
    if (error) {
      console.error("Default break insert error:", error);
      toast.error(t("schedule.toastFailedBreak"));
      return false;
    }
    return true;
  }, [barberId, selectedDateStr, defaultBreakTime]);

  useEffect(() => {
    const ensureBreak = async () => {
      if (settingsLoading || loading || !selectedDateStr || !defaultBreakTime) return;
      if (isBefore(startOfDay(parseISO(selectedDateStr)), startOfDay(new Date()))) return;
      const guardKey = `${barberId}-${selectedDateStr}`;
      if (breakCheckedRef.current === guardKey) return;
      breakCheckedRef.current = guardKey;
      const { data: existing, error } = await supabase
        .from("appointments").select("id").eq("barber_id", barberId).eq("appointment_date", selectedDateStr).eq("client_name", "BREAK");
      if (error) { breakCheckedRef.current = ""; return; }
      if ((existing?.length ?? 0) > 0) return; // Already has break(s), don't auto-insert
      const inserted = await insertDefaultBreak();
      if (inserted) await fetchAppointments();
      else breakCheckedRef.current = "";
    };
    ensureBreak();
  }, [barberId, defaultBreakTime, fetchAppointments, insertDefaultBreak, loading, selectedDateStr, settingsLoading]);

  // --- Actions ---
  const canCancel = (appt: Appointment): boolean => {
    const now = new Date();
    const [hour, minute] = appt.time_slot.split(":").map(Number);
    const d = parseISO(appt.appointment_date);
    d.setHours(hour, minute, 0, 0);
    return d.getTime() - now.getTime() >= 2 * 60 * 60 * 1000;
  };

  const updateStatus = async (id: string, status: "completed" | "no-show" | "cancelled", appt?: Appointment) => {
    if (status === "cancelled" && appt && !canCancel(appt)) {
      toast.error(t("schedule.toastCannotCancel2h"));
      return;
    }
    const query = status === "cancelled"
      ? supabase.from("appointments").delete().eq("id", id)
      : supabase.from("appointments").update({ status }).eq("id", id);
    const { error } = await query;
    if (error) { toast.error(t("schedule.toastFailedUpdate")); return; }
    toast.success(
      status === "cancelled"
        ? t("schedule.toastCancelled")
        : status === "completed"
          ? t("schedule.toastCompleted")
          : status === "no-show"
            ? t("schedule.toastNoShow")
            : t("schedule.toastMarkedAs").replace("{status}", status)
    );
    await fetchAppointments();
    if (status === "cancelled" && appt) {
      notifyWaitingList(appt.barber_id, appt.appointment_date, appt.time_slot.slice(0, 5), appt.barbers?.name || "");
    }
  };

  const addBreakAt = async (time: string) => {
    if (occupiedSlots.includes(time)) {
      toast.error(t("schedule.toastSlotTaken"));
      return;
    }

    const { data: services, error: serviceError } = await supabase
      .from("services")
      .select("id")
      .limit(1);

    if (serviceError || !services?.length) {
      console.error("Failed to load service for break:", serviceError);
      toast.error(t("schedule.toastFailedAddBreak"));
      return;
    }

    const breakInsert = {
      barber_id: barberId,
      service_id: services[0].id,
      appointment_date: selectedDateStr,
      time_slot: `${time}:00`,
      client_name: "BREAK",
      client_phone: null,
      client_email: null,
      contact_preference: "both",
      status: "booked",
    };

    console.log("Break insert payload:", breakInsert);
    const { error } = await supabase.from("appointments").insert(breakInsert);
    if (error) {
      console.error("Break insert error:", error);
      toast.error(t("schedule.toastFailedAddBreak"));
      return;
    }
    toast.success(t("schedule.toastBreakAdded"));
    fetchAppointments();
  };

  const addBlockAt = async (time: string) => {
    // Check if slot is already occupied
    if (occupiedSlots.includes(time)) {
      toast.error(t("schedule.toastSlotTaken"));
      return;
    }
    const { error } = await supabase.from("appointments").insert({
      barber_id: barberId, appointment_date: selectedDateStr, time_slot: `${time}:00`,
      client_name: "BLOCKED", status: "booked", client_phone: null, client_email: null, service_id: null,
    });
    if (error) { toast.error(t("schedule.toastFailedBlock")); return; }
    toast.success(t("schedule.toastSlotBlocked"));
    fetchAppointments();
  };

  const addBlockRange = async (start: string, end: string) => {
    const si = timeSlots.indexOf(start);
    const ei = timeSlots.indexOf(end);
    if (si < 0 || ei < 0 || si >= ei) { toast.error(t("schedule.toastInvalidRange")); return; }
    const slotsToBlock = timeSlots.slice(si, ei).filter(slot => !occupiedSlots.includes(slot));
    if (slotsToBlock.length === 0) { toast.error(t("schedule.toastAllTaken")); return; }
    const inserts = slotsToBlock.map(slot => ({
      barber_id: barberId, appointment_date: selectedDateStr, time_slot: `${slot}:00`,
      client_name: "BLOCKED" as const, status: "booked" as const, client_phone: null, client_email: null, service_id: null,
    }));
    const { error } = await supabase.from("appointments").insert(inserts);
    if (error) { toast.error(t("schedule.toastFailedBlock")); return; }
    toast.success(t("schedule.toastSlotsBlocked").replace("{n}", String(slotsToBlock.length)));
    fetchAppointments();
  };

  const removeSlot = async (id: string) => {
    await supabase.from("appointments").delete().eq("id", id);
    toast.success(t("schedule.toastRemoved"));
    fetchAppointments();
  };

  const moveAppointment = async (apptId: string, newTime: string) => {
    // Check if new slot is free
    const conflict = appointments.find(a => a.appointment_date === selectedDateStr && a.time_slot.slice(0, 5) === newTime);
    if (conflict) { toast.error(t("schedule.toastSlotTaken")); return; }
    const { error } = await supabase.from("appointments").update({ time_slot: `${newTime}:00` }).eq("id", apptId);
    if (error) { toast.error(t("schedule.toastFailedUpdate")); return; }
    toast.success(t("schedule.toastMoved"));
    fetchAppointments();
  };

  const toggleDayOff = async () => {
    if (isDayOff) {
      const dayOffIds = dayAppointments.filter(a => a.client_name === "DAYOFF").map(a => a.id);
      for (const id of dayOffIds) await supabase.from("appointments").delete().eq("id", id);
      toast.success(t("schedule.toastDayOffRemoved"));
    } else {
      const clientBookings = dayAppointments.filter(a => !["BREAK", "BLOCKED", "DAYOFF"].includes(a.client_name));
      if (clientBookings.length > 0) { toast.error(t("schedule.toastHasBookings")); return; }
      const toRemove = dayAppointments.filter(a => ["BREAK", "BLOCKED"].includes(a.client_name));
      for (const a of toRemove) await supabase.from("appointments").delete().eq("id", a.id);
      const { error } = await supabase.from("appointments").insert({
        barber_id: barberId, appointment_date: selectedDateStr, time_slot: `${settings.work_start}:00`,
        client_name: "DAYOFF", status: "booked", client_phone: null, client_email: null, service_id: null,
      });
      if (error) { toast.error(t("schedule.toastFailedDayOff")); return; }
      toast.success(t("schedule.toastDayOffMarked"));
    }
    fetchAppointments();
  };

  const closeModal = () => { setModalType(null); setModalAppt(null); setModalTime(""); setMoveTarget(""); };

  const handleSlotClick = (time: string) => {
    const appt = getAppointment(selectedDateStr, time);
    if (isPastStatic(selectedDateStr, time) && !appt) return;

    if (!appt) {
      setModalTime(time);
      setModalType("free");
      return;
    }

    if (appt.client_name === "BREAK") {
      setModalAppt(appt);
      setModalType("break");
    } else if (appt.client_name === "BLOCKED") {
      setModalAppt(appt);
      setModalType("blocked");
    } else if (appt.client_name === "DAYOFF") {
      // handled by control bar
    } else {
      setModalAppt(appt);
      setModalType("booked");
    }
  };

  const getAppointment = (dateStr: string, time: string) =>
    appointments.find(a => a.appointment_date === dateStr && a.time_slot.slice(0, 5) === time);

  const isPastDay = isBefore(startOfDay(selectedDate), startOfDay(new Date()));

  if (loading || settingsLoading) {
    return <p className="text-muted-foreground font-body p-4">{t("schedule.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      {/* View mode toggle */}
      <div className="flex items-center justify-center gap-2 bg-card border border-border rounded-xl p-1">
        <button
          onClick={() => setViewMode("appointments")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-body transition-colors ${
            viewMode === "appointments" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarDays size={15} /> Agenda
        </button>
        <button
          onClick={() => setViewMode("schedule")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-body transition-colors ${
            viewMode === "schedule" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock size={15} /> Meu Horário
        </button>
      </div>

      {viewMode === "schedule" ? (
        <MySchedulePanel barberId={barberId} />
      ) : (
        <>
          {/* Week nav */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft size={16} /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight size={16} /></Button>
          </div>

          {/* Day selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {weekDays.map((day, index) => {
              const active = index === selectedDay;
              const today = isToday(day);
              const hasDayOff = appointments.some(a => a.appointment_date === format(day, "yyyy-MM-dd") && a.client_name === "DAYOFF");
              return (
                <button
                  key={index}
                  onClick={() => setSelectedDay(index)}
                  className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-4 py-2 min-w-[56px] transition-colors relative ${
                    active ? "bg-primary text-primary-foreground shadow-md"
                      : today ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-card text-muted-foreground border border-border"
                  }`}
                >
                  <span className="text-[10px] font-body uppercase tracking-wider">{dayNames[index]}</span>
                  <span className="text-lg font-bold font-body">{format(day, "d")}</span>
                  {hasDayOff && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: RED }} />}
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground font-body">{format(selectedDate, "EEEE, dd/MM/yyyy")}</p>

          {/* Day OFF banner */}
          {isDayOff && (
            <div className="rounded-xl p-4 text-center space-y-2" style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)" }}>
              <CalendarOff size={24} className="mx-auto" style={{ color: RED }} />
              <p className="font-body text-sm font-medium" style={{ color: RED }}>Dia de Folga</p>
              {!isPastDay && (
                <Button size="sm" className="font-body text-xs" style={{ background: RED, color: "#fff" }} onClick={toggleDayOff}>
                  Remover Folga
                </Button>
              )}
            </div>
          )}

          {/* Time slots */}
          {!isDayOff && (
            <div className="space-y-1.5">
              {timeSlots.map((time) => {
                const appt = getAppointment(selectedDateStr, time);
                const past = isPastStatic(selectedDateStr, time);
                const isBreak = appt?.client_name === "BREAK";
                const isBlocked = appt?.client_name === "BLOCKED";
                const isClient = appt && !["BREAK", "BLOCKED", "DAYOFF"].includes(appt.client_name);

                if (past && !appt) {
                  return (
                    <div key={time} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground/40 font-body w-12 text-right">{time}</span>
                      <div className="flex-1 h-10 rounded-xl bg-muted/20" />
                    </div>
                  );
                }

                if (isBreak) {
                  return (
                    <div key={time} className="flex items-center gap-3">
                      <span className={`text-xs font-body w-12 text-right ${past ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{time}</span>
                      <button
                        onClick={() => !past && handleSlotClick(time)}
                        disabled={past}
                        className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                          past ? "bg-amber-500/10 text-amber-600/40" : "bg-amber-500/20 border border-amber-500/30 text-amber-600 hover:bg-amber-500/30"
                        }`}
                      >
                        <Coffee size={14} />
                        <span className="text-xs font-body font-medium">BREAK</span>
                      </button>
                    </div>
                  );
                }

                if (isBlocked) {
                  return (
                    <div key={time} className="flex items-center gap-3">
                      <span className={`text-xs font-body w-12 text-right ${past ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{time}</span>
                      <button
                        onClick={() => !past && handleSlotClick(time)}
                        disabled={past}
                        className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                          past ? "opacity-40" : "hover:opacity-80"
                        }`}
                        style={{ background: "rgba(255,68,68,0.15)", border: "1px solid rgba(255,68,68,0.3)", color: RED }}
                      >
                        <Ban size={14} />
                        <span className="text-xs font-body font-medium">BLOQUEADO</span>
                      </button>
                    </div>
                  );
                }

                if (isClient && appt) {
                  const serviceName = appt.services?.name || "";
                  return (
                    <div key={time} className="flex items-center gap-3">
                      <span className={`text-xs font-body w-12 text-right ${past ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{time}</span>
                      <button
                        onClick={() => handleSlotClick(time)}
                        className={`flex-1 h-10 rounded-xl flex items-center px-3 transition-colors ${
                          past ? "bg-red-900/20 text-muted-foreground/50" : "bg-red-900/40 border border-red-800/30 text-red-200 hover:bg-red-900/50"
                        }`}
                      >
                        <span className="text-xs font-body font-medium truncate">
                          {appt.client_name}{serviceName ? ` · ${serviceName}` : ""}
                        </span>
                      </button>
                    </div>
                  );
                }

                // Free slot
                return (
                  <div key={time} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-body w-12 text-right">{time}</span>
                    <button
                      onClick={() => handleSlotClick(time)}
                      className="flex-1 h-10 rounded-xl border border-dashed border-border/60 bg-card/50 flex items-center justify-center text-muted-foreground/60 hover:border-primary/40 hover:text-primary/60 transition-colors"
                    >
                      <span className="text-xs font-body">livre</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom control bar */}
          {!isDayOff && !isPastDay && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 font-body text-xs gap-1"
                style={{ borderColor: GOLD, color: GOLD }}
                onClick={() => { setBlockStart(""); setBlockEnd(""); setModalType("free"); setModalTime(""); }}
              >
                <Plus size={14} /> Break
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 font-body text-xs gap-1"
                style={{ borderColor: RED, color: RED }}
                onClick={() => { setBlockStart(""); setBlockEnd(""); setModalType("block-range"); }}
              >
                <Ban size={14} /> Bloquear
              </Button>
              <Button
                size="sm"
                className="font-body text-xs gap-1"
                style={{ background: RED, color: "#fff" }}
                onClick={toggleDayOff}
              >
                <CalendarOff size={14} /> OFF
              </Button>
            </div>
          )}

          {/* ====== BOTTOM SHEET MODALS ====== */}

          {/* BOOKED appointment modal */}
          <Sheet open={modalType === "booked" && !!modalAppt} onOpenChange={(o) => !o && closeModal()}>
            <SheetContent side="bottom" className="rounded-t-2xl border-t" style={{ background: "#1a1a1a", borderColor: "#2e2e2e" }}>
              {modalAppt && (
                <div className="space-y-4 pb-4">
                  <SheetHeader>
                    <SheetTitle className="font-body text-foreground text-left">{modalAppt.client_name}</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-2">
                    {modalAppt.services?.name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
                        <Scissors size={14} style={{ color: GOLD }} />
                        <span>{modalAppt.services.name} — €{modalAppt.services.price}</span>
                      </div>
                    )}
                    {modalAppt.client_phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
                        <Phone size={14} style={{ color: GOLD }} />
                        <a href={`tel:${modalAppt.client_phone}`} className="underline">{modalAppt.client_phone}</a>
                      </div>
                    )}
                    {modalAppt.client_email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
                        <Mail size={14} style={{ color: GOLD }} />
                        <a href={`mailto:${modalAppt.client_email}`} className="underline">{modalAppt.client_email}</a>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
                      <Clock size={14} style={{ color: GOLD }} />
                      <span>{modalAppt.time_slot.slice(0, 5)} — {modalAppt.appointment_date}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      className="w-full font-body text-sm gap-2"
                      style={{ background: GOLD, color: "#111" }}
                      onClick={() => { setModalType("move"); setMoveTarget(""); }}
                    >
                      <ArrowRight size={16} /> Mover agendamento
                    </Button>
                    <Button
                      className="w-full font-body text-sm gap-2"
                      variant="outline"
                      onClick={() => { updateStatus(modalAppt.id, "completed"); closeModal(); }}
                    >
                      <Check size={16} /> Marcar como concluído
                    </Button>
                    {canCancel(modalAppt) && (
                      <Button
                        className="w-full font-body text-sm gap-2"
                        style={{ background: RED, color: "#fff" }}
                        onClick={() => {
                          updateStatus(modalAppt.id, "cancelled", modalAppt);
                          closeModal();
                        }}
                      >
                        <Trash2 size={16} /> Cancelar agendamento
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* MOVE appointment modal */}
          <Sheet open={modalType === "move" && !!modalAppt} onOpenChange={(o) => !o && closeModal()}>
            <SheetContent side="bottom" className="rounded-t-2xl border-t" style={{ background: "#1a1a1a", borderColor: "#2e2e2e" }}>
              {modalAppt && (
                <div className="space-y-4 pb-4">
                  <SheetHeader>
                    <SheetTitle className="font-body text-foreground text-left">Mover para novo horário</SheetTitle>
                  </SheetHeader>
                  <Select value={moveTarget} onValueChange={setMoveTarget}>
                    <SelectTrigger className="bg-background border-border text-foreground font-body">
                      <SelectValue placeholder="Escolher horário..." />
                    </SelectTrigger>
                    <SelectContent>
                      {freeSlots.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full font-body text-sm"
                    style={{ background: GOLD, color: "#111" }}
                    disabled={!moveTarget}
                    onClick={async () => {
                      await moveAppointment(modalAppt.id, moveTarget);
                      closeModal();
                    }}
                  >
                    Confirmar
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* FREE slot modal */}
          <Sheet open={modalType === "free"} onOpenChange={(o) => !o && closeModal()}>
            <SheetContent side="bottom" className="rounded-t-2xl border-t" style={{ background: "#1a1a1a", borderColor: "#2e2e2e" }}>
              <div className="space-y-4 pb-4">
                <SheetHeader>
                  <SheetTitle className="font-body text-foreground text-left">
                    {modalTime ? `Slot ${modalTime}` : "Adicionar Pausa"}
                  </SheetTitle>
                </SheetHeader>

                {modalTime ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full font-body text-sm gap-2"
                      style={{ background: GOLD, color: "#111" }}
                      onClick={async () => { await addBreakAt(modalTime); closeModal(); }}
                    >
                      <Coffee size={16} /> Adicionar break aqui
                    </Button>
                    <Button
                      className="w-full font-body text-sm gap-2"
                      style={{ background: RED, color: "#fff" }}
                      onClick={async () => { await addBlockAt(modalTime); closeModal(); }}
                    >
                      <Ban size={16} /> Bloquear este horário
                    </Button>
                  </div>
                ) : (
                  /* Break picker from control bar */
                  <div className="space-y-3">
                    <Select onValueChange={async (v) => { await addBreakAt(v); closeModal(); }}>
                      <SelectTrigger className="bg-background border-border text-foreground font-body">
                        <SelectValue placeholder="Escolher horário para pausa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {freeSlots.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* BREAK slot modal */}
          <Sheet open={modalType === "break" && !!modalAppt} onOpenChange={(o) => !o && closeModal()}>
            <SheetContent side="bottom" className="rounded-t-2xl border-t" style={{ background: "#1a1a1a", borderColor: "#2e2e2e" }}>
              {modalAppt && (
                <div className="space-y-4 pb-4">
                  <SheetHeader>
                    <SheetTitle className="font-body text-left" style={{ color: GOLD }}>
                      <div className="flex items-center gap-2"><Coffee size={18} /> Pausa — {modalAppt.time_slot.slice(0, 5)}</div>
                    </SheetTitle>
                  </SheetHeader>
                  <Button
                    className="w-full font-body text-sm gap-2"
                    style={{ background: RED, color: "#fff" }}
                    onClick={async () => { await removeSlot(modalAppt.id); closeModal(); }}
                  >
                    <Trash2 size={16} /> Remover pausa
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* BLOCKED slot modal */}
          <Sheet open={modalType === "blocked" && !!modalAppt} onOpenChange={(o) => !o && closeModal()}>
            <SheetContent side="bottom" className="rounded-t-2xl border-t" style={{ background: "#1a1a1a", borderColor: "#2e2e2e" }}>
              {modalAppt && (
                <div className="space-y-4 pb-4">
                  <SheetHeader>
                    <SheetTitle className="font-body text-left" style={{ color: RED }}>
                      <div className="flex items-center gap-2"><Ban size={18} /> Bloqueado — {modalAppt.time_slot.slice(0, 5)}</div>
                    </SheetTitle>
                  </SheetHeader>
                  <Button
                    className="w-full font-body text-sm gap-2"
                    style={{ background: GOLD, color: "#111" }}
                    onClick={async () => { await removeSlot(modalAppt.id); closeModal(); }}
                  >
                    <Check size={16} /> Desbloquear horário
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* BLOCK RANGE modal */}
          <Sheet open={modalType === "block-range"} onOpenChange={(o) => !o && closeModal()}>
            <SheetContent side="bottom" className="rounded-t-2xl border-t" style={{ background: "#1a1a1a", borderColor: "#2e2e2e" }}>
              <div className="space-y-4 pb-4">
                <SheetHeader>
                  <SheetTitle className="font-body text-left" style={{ color: RED }}>
                    <div className="flex items-center gap-2"><Ban size={18} /> Bloquear intervalo</div>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex items-center gap-2">
                  <Select value={blockStart} onValueChange={setBlockStart}>
                    <SelectTrigger className="flex-1 bg-background border-border text-foreground font-body text-sm">
                      <SelectValue placeholder="De" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-sm">→</span>
                  <Select value={blockEnd} onValueChange={setBlockEnd}>
                    <SelectTrigger className="flex-1 bg-background border-border text-foreground font-body text-sm">
                      <SelectValue placeholder="Até" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.filter(t => t > blockStart).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full font-body text-sm"
                  style={{ background: RED, color: "#fff" }}
                  disabled={!blockStart || !blockEnd}
                  onClick={async () => {
                    await addBlockRange(blockStart, blockEnd);
                    closeModal();
                  }}
                >
                  Bloquear
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Cancel confirm dialog */}
          <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif">Cancelar agendamento?</AlertDialogTitle>
                <AlertDialogDescription className="font-body">
                  Tens a certeza que queres cancelar o agendamento de{" "}
                  <span className="font-semibold text-foreground">{cancelTarget?.client_name}</span>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-body">Não</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-body"
                  onClick={() => { if (cancelTarget) { updateStatus(cancelTarget.id, "cancelled", cancelTarget); setCancelTarget(null); } }}
                >
                  Sim, cancelar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
};

function isPastStatic(dateStr: string, time: string): boolean {
  const now = new Date();
  const [hour, minute] = time.split(":").map(Number);
  const date = parseISO(dateStr);
  date.setHours(hour, minute, 0, 0);
  return isBefore(date, now);
}


export default ScheduleTab;
