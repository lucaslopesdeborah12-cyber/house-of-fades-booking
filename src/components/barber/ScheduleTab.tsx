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
import { Check, X, Ban, Coffee, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const breakCheckedRef = useRef<string>("");

  const dayCount = getDayCount(settings.last_working_day);
  const timeSlots = generateTimeSlots(settings.work_start, settings.work_end);
  const dayNames = DAY_NAMES_ALL.slice(0, dayCount);
  const defaultBreakTime = settings.default_break_time;
  const weekDays = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const selectedDate = weekDays[selectedDay] || weekDays[0];
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    if (settingsLoading) return;
    const today = new Date();
    const lastDay = addDays(weekStart, dayCount - 1);
    lastDay.setHours(23, 59, 59, 999);

    if (isAfter(today, lastDay)) {
      setWeekStart(addWeeks(weekStart, 1));
    }
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
      .select(
        "id, appointment_date, barber_id, client_email, client_name, client_phone, contact_preference, created_at, notes, service_id, status, time_slot, updated_at, services(name, price), barbers(name)"
      )
      .eq("barber_id", barberId)
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .in("status", ["booked", "confirmed"])
      .order("appointment_date")
      .order("time_slot");

    if (error) {
      toast.error("Failed to load schedule");
    } else {
      setAppointments((data || []) as Appointment[]);
    }

    setLoading(false);
  }, [barberId, weekStart, dayCount]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    breakCheckedRef.current = "";
  }, [selectedDateStr, barberId]);

  const insertDefaultBreak = useCallback(async () => {
    const { error } = await supabase.from("appointments").insert({
      barber_id: barberId,
      appointment_date: selectedDateStr,
      time_slot: `${defaultBreakTime}:00`,
      client_name: "BREAK",
      status: "booked",
      client_phone: null,
      client_email: null,
      service_id: null,
    });

    if (error) {
      console.error("[BreakSystem] Failed to insert default break:", error);
      toast.error("Failed to create break");
      return false;
    }

    return true;
  }, [barberId, selectedDateStr, defaultBreakTime]);

  useEffect(() => {
    const ensureSingleBreakForDay = async () => {
      if (settingsLoading || loading || !selectedDateStr || !defaultBreakTime) return;

      const selectedDayStart = startOfDay(parseISO(selectedDateStr));
      if (isBefore(selectedDayStart, startOfDay(new Date()))) return;

      const guardKey = `${barberId}-${selectedDateStr}`;
      if (breakCheckedRef.current === guardKey) return;
      breakCheckedRef.current = guardKey;

      const { data: existingBreaks, error } = await supabase
        .from("appointments")
        .select("id")
        .eq("barber_id", barberId)
        .eq("appointment_date", selectedDateStr)
        .eq("client_name", "BREAK");

      if (error) {
        console.error("[BreakSystem] Failed to fetch breaks:", error);
        breakCheckedRef.current = "";
        return;
      }

      const breakCount = existingBreaks?.length ?? 0;

      if (breakCount === 1) return;

      if (breakCount > 1) {
        const { error: deleteError } = await supabase
          .from("appointments")
          .delete()
          .eq("barber_id", barberId)
          .eq("appointment_date", selectedDateStr)
          .eq("client_name", "BREAK");

        if (deleteError) {
          console.error("[BreakSystem] Failed to delete duplicate breaks:", deleteError);
          toast.error("Failed to reset break");
          breakCheckedRef.current = "";
          return;
        }
      }

      const inserted = await insertDefaultBreak();
      if (inserted) {
        await fetchAppointments();
      } else {
        breakCheckedRef.current = "";
      }
    };

    ensureSingleBreakForDay();
  }, [barberId, defaultBreakTime, fetchAppointments, insertDefaultBreak, loading, selectedDateStr, settingsLoading]);

  const canCancel = (appt: Appointment): boolean => {
    const now = new Date();
    const [hour, minute] = appt.time_slot.split(":").map(Number);
    const appointmentDate = parseISO(appt.appointment_date);
    appointmentDate.setHours(hour, minute, 0, 0);
    return appointmentDate.getTime() - now.getTime() >= 2 * 60 * 60 * 1000;
  };

  const isPast = (dateStr: string, time: string): boolean => {
    const now = new Date();
    const [hour, minute] = time.split(":").map(Number);
    const date = parseISO(dateStr);
    date.setHours(hour, minute, 0, 0);
    return isBefore(date, now);
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

    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);

    if (error) {
      toast.error("Failed to update");
      return;
    }

    toast.success(`Marked as ${status}`);
    await fetchAppointments();

    if (status === "cancelled" && appt) {
      const timeSlot = appt.time_slot.slice(0, 5);
      notifyWaitingList(appt.barber_id, appt.appointment_date, timeSlot, appt.barbers?.name || "");
    }
  };

  const moveBreak = async (breakId: string, dateStr: string, newTime: string) => {
    const { error } = await (supabase.rpc as any)("move_daily_break", {
      p_break_id: breakId,
      p_barber_id: barberId,
      p_appointment_date: dateStr,
      p_new_time_slot: `${newTime}:00`,
    });

    if (error) {
      console.error("[BreakSystem] Failed to move break:", error);
      toast.error("Failed to move break");
      return;
    }

    toast.success("Break moved");
    await fetchAppointments();
  };

  const getFreeSlots = (dateStr: string): string[] => {
    return timeSlots.filter((time) => {
      const occupied = appointments.find(
        (appointment) => appointment.appointment_date === dateStr && appointment.time_slot.slice(0, 5) === time
      );
      return !occupied && !isPast(dateStr, time);
    });
  };

  const getAppointment = (dateStr: string, time: string) => {
    return appointments.find(
      (appointment) => appointment.appointment_date === dateStr && appointment.time_slot.slice(0, 5) === time
    );
  };

  if (loading || settingsLoading) {
    return <p className="text-muted-foreground font-body p-4">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {weekDays.map((day, index) => {
          const active = index === selectedDay;
          const today = isToday(day);

          return (
            <button
              key={index}
              onClick={() => setSelectedDay(index)}
              className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-4 py-2 min-w-[56px] transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : today
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card text-muted-foreground border border-border"
              }`}
            >
              <span className="text-[10px] font-body uppercase tracking-wider">{dayNames[index]}</span>
              <span className="text-lg font-bold font-body">{format(day, "d")}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground font-body">
        {format(selectedDate, "EEEE, dd/MM/yyyy")}
      </p>

      <div className="space-y-1.5">
        {timeSlots.map((time) => {
          const appt = getAppointment(selectedDateStr, time);
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
              onMoveBreak={moveBreak}
              onUpdateStatus={updateStatus}
              onCancelRequest={setCancelTarget}
              canCancel={canCancel}
            />
          );
        })}
      </div>

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
              onClick={() => {
                if (cancelTarget) {
                  updateStatus(cancelTarget.id, "cancelled", cancelTarget);
                  setCancelTarget(null);
                }
              }}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface SlotRowProps {
  time: string;
  appt: Appointment | undefined;
  past: boolean;
  isBreak: boolean;
  dateStr: string;
  freeSlots: string[];
  onMoveBreak: (breakId: string, dateStr: string, newTime: string) => void;
  onUpdateStatus: (id: string, status: "completed" | "no-show" | "cancelled", appt?: Appointment) => void;
  onCancelRequest: (appt: Appointment) => void;
  canCancel: (appt: Appointment) => boolean;
}

const SlotRow = ({
  time,
  appt,
  past,
  isBreak,
  dateStr,
  freeSlots,
  onMoveBreak,
  onUpdateStatus,
  onCancelRequest,
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
        <div className="flex-1 h-10 rounded-xl border border-dashed border-border/60 bg-card/50 flex items-center justify-center text-muted-foreground/60">
          <span className="text-xs font-body">livre</span>
        </div>
      </div>
    );
  }

  console.log("Appointment object:", appt);

  if (isBreak) {
    const breakLabel = appt.client_name;

    const pill = (
      <div
        className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 ${
          past
            ? "bg-amber-500/10 text-amber-600/40"
            : "bg-amber-500/20 border border-amber-500/30 text-amber-600"
        }`}
      >
        <Coffee size={14} />
        <span className="text-xs font-body font-medium">{breakLabel}</span>
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
              <span className="text-xs font-body font-medium">{breakLabel}</span>
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
          <span className="text-xs font-body truncate">
            {displayName}
            {serviceName ? ` · ${serviceName}` : ""}
          </span>
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
            <span className="text-xs font-body font-medium truncate">
              {displayName}
              {serviceName ? ` · ${serviceName}` : ""}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 space-y-2" side="top" align="center">
          <div className="px-1">
            <p className="text-sm font-body font-semibold text-foreground">{appt.client_name}</p>
            <p className="text-xs text-muted-foreground font-body">
              {serviceName} — {time}
            </p>
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
                cancellable ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground/50 cursor-not-allowed"
              }`}
              onClick={() => cancellable && onCancelRequest(appt)}
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
