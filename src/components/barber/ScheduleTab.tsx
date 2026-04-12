import { useEffect, useState, useCallback } from "react";
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
import { Check, X, Ban, Coffee, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { notifyWaitingList } from "@/lib/waitingListNotifier";
import { useShopSettings, getDayCount, generateTimeSlots } from "@/hooks/useShopSettings";

type Appointment = Tables<"appointments"> & {
  services: { name: string; price: number } | null;
  barbers: { name: string } | null;
};

const DAY_NAMES_ALL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const ScheduleTab = ({ barberId }: { barberId: string }) => {
  const { settings, loading: settingsLoading } = useShopSettings();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState(0);
  const [autoBreakKey, setAutoBreakKey] = useState<string | null>(null);

  const dayCount = getDayCount(settings.last_working_day);
  const TIME_SLOTS = generateTimeSlots(settings.work_start, settings.work_end);
  const DAY_NAMES = DAY_NAMES_ALL.slice(0, dayCount);
  const defaultBreakTime = settings.default_break_time;

  useEffect(() => {
    if (settingsLoading) return;
    const today = new Date();
    const lastDay = addDays(weekStart, dayCount - 1);
    lastDay.setHours(23, 59, 59, 999);

    if (isAfter(today, lastDay)) {
      setWeekStart(addWeeks(weekStart, 1));
    }
  }, [settingsLoading, weekStart, dayCount]);

  const weekDays = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const selectedDate = weekDays[selectedDay] || weekDays[0];
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    const todayIdx = weekDays.findIndex((d) => isToday(d));
    setSelectedDay(todayIdx >= 0 ? todayIdx : 0);
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

    if (error) {
      toast.error("Failed to load schedule");
    } else if (data) {
      setAppointments(data as Appointment[]);
    }
    setLoading(false);
  }, [barberId, weekStart, dayCount]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    setAutoBreakKey(null);
  }, [selectedDateStr, defaultBreakTime, barberId]);

  useEffect(() => {
    const ensureAutoBreak = async () => {
      if (settingsLoading || loading || !selectedDateStr || !defaultBreakTime) return;

      const checkKey = `${barberId}-${selectedDateStr}-${defaultBreakTime}`;
      if (autoBreakKey === checkKey) return;

      const selectedDayDate = startOfDay(parseISO(selectedDateStr));
      if (isBefore(selectedDayDate, startOfDay(new Date()))) {
        setAutoBreakKey(checkKey);
        return;
      }

      const dayAppointments = appointments.filter((appt) => appt.appointment_date === selectedDateStr);
      const hasBreak = dayAppointments.some((appt) => appt.client_name === "BREAK");

      if (hasBreak) {
        setAutoBreakKey(checkKey);
        return;
      }

      const timeSlotValue = `${defaultBreakTime}:00`;
      const occupied = dayAppointments.some((appt) => appt.time_slot === timeSlotValue);
      if (occupied) {
        setAutoBreakKey(checkKey);
        return;
      }

      const { error } = await supabase.from("appointments").insert({
        barber_id: barberId,
        appointment_date: selectedDateStr,
        time_slot: timeSlotValue,
        client_name: "BREAK",
        client_phone: null,
        service_id: null,
        status: "booked",
      });

      if (error) {
        console.error("Auto-break insert failed:", error);
        toast.error("Failed to create break");
        return;
      }

      setAutoBreakKey(checkKey);
      await fetchAppointments();
    };

    ensureAutoBreak();
  }, [appointments, autoBreakKey, barberId, defaultBreakTime, fetchAppointments, loading, selectedDateStr, settingsLoading]);

  const canCancel = (appt: Appointment): boolean => {
    const now = new Date();
    const [h, m] = appt.time_slot.split(":").map(Number);
    const apptDate = parseISO(appt.appointment_date);
    apptDate.setHours(h, m, 0, 0);
    return apptDate.getTime() - now.getTime() >= 2 * 60 * 60 * 1000;
  };

  const isPast = (dateStr: string, time: string): boolean => {
    const now = new Date();
    const [h, m] = time.split(":").map(Number);
    const d = parseISO(dateStr);
    d.setHours(h, m, 0, 0);
    return isBefore(d, now);
  };

  const updateStatus = async (
    id: string,
    status: "completed" | "no-show" | "cancelled",
    appt?: Appointment
  ) => {
    if (status === "cancelled" && appt && !canCancel(appt)) {
      toast.error("Cannot cancel within 2 hours of appointment.");
      return;
    }

    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success(`Marked as ${status}`);
      fetchAppointments();
      if (status === "cancelled" && appt) {
        const timeSlot = appt.time_slot.slice(0, 5);
        notifyWaitingList(appt.barber_id, appt.appointment_date, timeSlot, appt.barbers?.name || "");
      }
    }
  };

  const addBreak = async (dateStr: string, time: string) => {
    const { error } = await supabase.from("appointments").insert({
      barber_id: barberId,
      appointment_date: dateStr,
      time_slot: `${time}:00`,
      client_name: "BREAK",
      client_phone: "",
      status: "booked",
      service_id: null,
    });

    if (error) {
      toast.error("Failed to add break");
    } else {
      toast.success("Break added");
      fetchAppointments();
    }
  };

  const removeBreak = async (id: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to remove break");
    } else {
      toast.success("Break removed");
      fetchAppointments();
    }
  };

  const moveBreak = async (breakId: string, dateStr: string, newTime: string) => {
    const { error: delErr } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", breakId);

    if (delErr) {
      toast.error("Failed to move break");
      return;
    }

    const { error: insErr } = await supabase.from("appointments").insert({
      barber_id: barberId,
      appointment_date: dateStr,
      time_slot: `${newTime}:00`,
      client_name: "BREAK",
      client_phone: "",
      status: "booked",
      service_id: null,
    });

    if (insErr) {
      toast.error("Failed to move break");
    } else {
      toast.success("Break moved");
      fetchAppointments();
    }
  };

  const getFreeSlots = (dateStr: string): string[] => {
    return TIME_SLOTS.filter((t) => {
      const occupied = appointments.find(
        (a) => a.appointment_date === dateStr && a.time_slot.slice(0, 5) === t
      );
      return !occupied && !isPast(dateStr, t);
    });
  };

  const getAppt = (dateStr: string, time: string) =>
    appointments.find(
      (a) => a.appointment_date === dateStr && a.time_slot.slice(0, 5) === time
    );

  if (loading || settingsLoading) return <p className="text-muted-foreground font-body p-4">Loading…</p>;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {weekDays.map((d, i) => {
          const active = i === selectedDay;
          const today = isToday(d);
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-4 py-2 min-w-[56px] transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : today
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              <span className="text-[10px] font-body uppercase tracking-wider">{DAY_NAMES[i]}</span>
              <span className="text-lg font-bold font-body">{format(d, "d")}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground font-body">
        {format(selectedDate, "EEEE, dd/MM/yyyy")}
      </p>

      {/* Time slots */}
      <div className="space-y-1.5">
        {TIME_SLOTS.map((time) => {
          const appt = getAppt(selectedDateStr, time);
          const past = isPast(selectedDateStr, time);
          const isBreak = appt?.client_name === "BREAK";

          return (
            <SlotRow
              key={time}
              time={time}
              appt={appt}
              past={past}
              isBreak={isBreak}
              dateStr={selectedDateStr}
              freeSlots={getFreeSlots(selectedDateStr)}
              onAddBreak={addBreak}
              onRemoveBreak={removeBreak}
              onMoveBreak={moveBreak}
              onUpdateStatus={updateStatus}
              canCancel={canCancel}
            />
          );
        })}
      </div>
    </div>
  );
};

/* ── Slot Row ── */

interface SlotRowProps {
  time: string;
  appt: Appointment | undefined;
  past: boolean;
  isBreak: boolean;
  dateStr: string;
  freeSlots: string[];
  onAddBreak: (d: string, t: string) => void;
  onRemoveBreak: (id: string) => void;
  onMoveBreak: (breakId: string, dateStr: string, newTime: string) => void;
  onUpdateStatus: (id: string, s: "completed" | "no-show" | "cancelled", a?: Appointment) => void;
  canCancel: (a: Appointment) => boolean;
}

const SlotRow = ({
  time,
  appt,
  past,
  isBreak,
  dateStr,
  freeSlots,
  onAddBreak,
  onRemoveBreak,
  onMoveBreak,
  onUpdateStatus,
  canCancel,
}: SlotRowProps) => {
  if (past && !appt) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground/40 font-body w-12 text-right">{time}</span>
        <div className="flex-1 h-10 rounded-xl bg-muted/20" />
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-body w-12 text-right">{time}</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex-1 h-10 rounded-xl border border-dashed border-border/60 bg-card/50 flex items-center justify-center gap-1.5 text-muted-foreground/60 hover:border-primary/40 hover:text-primary/80 transition-colors">
              <Plus size={14} />
              <span className="text-xs font-body">livre</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top" align="center">
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-body"
              onClick={() => onAddBreak(dateStr, time)}
            >
              <Coffee size={14} className="mr-1.5" /> Break
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  if (isBreak) {
    const pill = (
      <div className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 ${
        past
          ? "bg-amber-500/10 text-amber-600/40"
          : "bg-amber-500/20 border border-amber-500/30 text-amber-600"
      }`}>
        <Coffee size={14} />
        <span className="text-xs font-body font-medium">Break</span>
      </div>
    );

    if (past) {
      return (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground/40 font-body w-12 text-right">{time}</span>
          {pill}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-body w-12 text-right">{time}</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex-1 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center gap-1.5 text-amber-600 hover:bg-amber-500/30 transition-colors">
              <Coffee size={14} />
              <span className="text-xs font-body font-medium">Break</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2 max-h-60 overflow-y-auto" side="top" align="center">
            <p className="text-xs font-body text-muted-foreground px-1 mb-1.5">Move break to:</p>
            <div className="flex flex-col gap-0.5">
              {freeSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 font-body px-1">No free slots</p>
              ) : (
                freeSlots.map((slot) => (
                  <Button
                    key={slot}
                    size="sm"
                    variant="ghost"
                    className="justify-start text-foreground hover:bg-muted font-body text-xs h-8"
                    onClick={() => onMoveBreak(appt.id, dateStr, slot)}
                  >
                    <Coffee size={12} className="mr-1.5 text-amber-600" /> {slot}
                  </Button>
                ))
              )}
            </div>
            <div className="border-t border-border mt-1.5 pt-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="justify-start text-red-500 hover:text-red-600 hover:bg-red-50 font-body text-xs w-full h-8"
                onClick={() => onRemoveBreak(appt.id)}
              >
                <X size={12} className="mr-1.5" /> Remove break
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  const displayName = appt.client_name;
  const serviceName = appt.services?.name || "";
  const cancellable = canCancel(appt);

  if (past) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground/40 font-body w-12 text-right">{time}</span>
        <div className="flex-1 h-10 rounded-xl bg-red-900/20 flex items-center px-3 text-muted-foreground/50">
          <span className="text-xs font-body truncate">{displayName}{serviceName ? ` · ${serviceName}` : ""}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground font-body w-12 text-right">{time}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex-1 h-10 rounded-xl bg-red-900/40 border border-red-800/30 flex items-center px-3 text-red-200 hover:bg-red-900/50 transition-colors">
            <span className="text-xs font-body font-medium truncate">{displayName}{serviceName ? ` · ${serviceName}` : ""}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 space-y-2" side="top" align="center">
          <div className="px-1">
            <p className="text-sm font-body font-semibold text-foreground">{appt.client_name}</p>
            <p className="text-xs text-muted-foreground font-body">{serviceName} — {time}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="justify-start text-accent hover:bg-accent/10 font-body"
              onClick={() => onUpdateStatus(appt.id, "completed")}
            >
              <Check size={14} className="mr-1.5" /> Completed
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`justify-start font-body ${
                cancellable
                  ? "text-red-500 hover:bg-red-50"
                  : "text-muted-foreground/50 cursor-not-allowed"
              }`}
              onClick={() => onUpdateStatus(appt.id, "cancelled", appt)}
            >
              <Ban size={14} className="mr-1.5" /> Cancel
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="justify-start text-foreground hover:bg-muted font-body"
              onClick={() => onUpdateStatus(appt.id, "no-show")}
            >
              <X size={14} className="mr-1.5" /> No-show
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ScheduleTab;
