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
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";
import { Check, X, Ban, Coffee, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { notifyWaitingList } from "@/lib/waitingListNotifier";

type Appointment = Tables<"appointments"> & {
  services: { name: string; price: number } | null;
  barbers: { name: string } | null;
};

const HOURS_START = 9;
const HOURS_END = 19;
const SLOT_MINUTES = 30;

function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = HOURS_START; h < HOURS_END; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

const ScheduleTab = ({ barberId }: { barberId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchAppointments = useCallback(async () => {
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addDays(weekStart, 6), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("appointments")
      .select("*, services(name, price), barbers(name)")
      .eq("barber_id", barberId)
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .in("status", ["booked", "confirmed"])
      .order("appointment_date")
      .order("time_slot");

    if (!error && data) setAppointments(data as Appointment[]);
    setLoading(false);
  }, [barberId, weekStart]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

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
      time_slot: time,
      client_name: "BREAK",
      status: "booked",
      service_id: null as any,
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

  const getAppt = (dateStr: string, time: string) =>
    appointments.find(
      (a) => a.appointment_date === dateStr && a.time_slot.slice(0, 5) === time
    );

  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  if (loading) return <p className="text-muted-foreground font-body p-4">Loading…</p>;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
        <span className="font-body text-sm text-muted-foreground">
          {format(weekStart, "dd MMM")} – {format(addDays(weekStart, 6), "dd MMM yyyy")}
        </span>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full min-w-[700px] text-xs">
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="p-2 text-left text-muted-foreground font-body w-16">Time</th>
              {weekDays.map((d) => (
                <th
                  key={d.toISOString()}
                  className={`p-2 text-center font-body ${
                    isToday(d) ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <div>{format(d, "EEE")}</div>
                  <div className="text-[10px]">{format(d, "dd/MM")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((time) => (
              <tr key={time} className="border-b border-border/50">
                <td className="p-1.5 text-muted-foreground font-body font-medium">{time}</td>
                {weekDays.map((d) => {
                  const dateStr = format(d, "yyyy-MM-dd");
                  const appt = getAppt(dateStr, time);
                  const past = isPast(dateStr, time);
                  const isBreak = appt?.client_name === "BREAK";

                  return (
                    <td key={dateStr + time} className="p-0.5">
                      <SlotCell
                        appt={appt}
                        past={past}
                        isBreak={isBreak}
                        dateStr={dateStr}
                        time={time}
                        onAddBreak={addBreak}
                        onRemoveBreak={removeBreak}
                        onUpdateStatus={updateStatus}
                        canCancel={canCancel}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Slot Cell ── */

interface SlotCellProps {
  appt: Appointment | undefined;
  past: boolean;
  isBreak: boolean;
  dateStr: string;
  time: string;
  onAddBreak: (d: string, t: string) => void;
  onRemoveBreak: (id: string) => void;
  onUpdateStatus: (id: string, s: "completed" | "no-show" | "cancelled", a?: Appointment) => void;
  canCancel: (a: Appointment) => boolean;
}

const SlotCell = ({
  appt,
  past,
  isBreak,
  dateStr,
  time,
  onAddBreak,
  onRemoveBreak,
  onUpdateStatus,
  canCancel,
}: SlotCellProps) => {
  if (past && !appt) {
    return <div className="h-8 rounded bg-muted/30" />;
  }

  if (!appt) {
    if (past) return <div className="h-8 rounded bg-muted/30" />;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="h-8 w-full rounded border border-dashed border-border/40 flex items-center justify-center text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60 transition-colors">
            <Plus size={12} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="right" align="start">
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-body"
            onClick={() => onAddBreak(dateStr, time)}
          >
            <Coffee size={14} className="mr-1.5" /> Add Break
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  // Break slot
  if (isBreak) {
    if (past) {
      return (
        <div className="h-8 rounded bg-amber-500/10 flex items-center justify-center gap-1 text-amber-600/50">
          <Coffee size={10} />
          <span className="text-[10px] font-body">Break</span>
        </div>
      );
    }
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="h-8 w-full rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center gap-1 text-amber-600 hover:bg-amber-500/30 transition-colors">
            <Coffee size={10} />
            <span className="text-[10px] font-body font-medium">Break</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="right" align="start">
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 font-body"
            onClick={() => onRemoveBreak(appt.id)}
          >
            <X size={14} className="mr-1.5" /> Remove Break
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  // Client slot
  const firstName = appt.client_name.split(" ")[0];
  const cancellable = canCancel(appt);

  if (past) {
    return (
      <div className="h-8 rounded bg-primary/10 flex items-center justify-center text-muted-foreground/60">
        <span className="text-[10px] font-body truncate px-1">{firstName}</span>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="h-8 w-full rounded bg-primary/20 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors">
          <span className="text-[10px] font-body font-medium truncate px-1">{firstName}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 space-y-1" side="right" align="start">
        <p className="text-xs font-body font-medium text-foreground px-2 py-1">
          {appt.client_name}
          {appt.services?.name && <span className="text-muted-foreground"> — {appt.services.name}</span>}
        </p>
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
  );
};

export default ScheduleTab;
