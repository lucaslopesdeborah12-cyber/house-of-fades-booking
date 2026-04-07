import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { format, startOfWeek, startOfMonth, isToday, parseISO, isFuture } from "date-fns";
import { Check, X, Clock, Calendar, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notifyWaitingList } from "@/lib/waitingListNotifier";

type Appointment = Tables<"appointments"> & {
  services: { name: string; price: number } | null;
  barbers: { name: string } | null;
};

const ScheduleTab = ({ barberId }: { barberId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, services(name, price), barbers(name)")
      .eq("barber_id", barberId)
      .gte("appointment_date", format(new Date(), "yyyy-MM-dd"))
      .order("appointment_date", { ascending: true })
      .order("time_slot", { ascending: true });

    if (!error && data) setAppointments(data as Appointment[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [barberId]);

  const canCancel = (appt: Appointment): boolean => {
    const now = new Date();
    const [h, m] = appt.time_slot.split(":").map(Number);
    const apptDate = parseISO(appt.appointment_date);
    apptDate.setHours(h, m, 0, 0);
    const diff = apptDate.getTime() - now.getTime();
    return diff >= 2 * 60 * 60 * 1000; // 2 hours
  };

  const updateStatus = async (id: string, status: "completed" | "no-show" | "cancelled", appt?: Appointment) => {
    if (status === "cancelled" && appt && !canCancel(appt)) {
      toast.error("Sorry, this appointment can no longer be cancelled. Please contact us directly.");
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
      
      // If cancelled, notify waiting list
      if (status === "cancelled" && appt) {
        console.log("[ScheduleTab] Appointment cancelled, notifying waiting list");
        const timeSlot = appt.time_slot.slice(0, 5);
        notifyWaitingList(appt.barber_id, appt.appointment_date, timeSlot, appt.barbers?.name || "");
      }
    }
  };

  const todayAppts = appointments.filter((a) => isToday(parseISO(a.appointment_date)));
  const upcomingAppts = appointments.filter(
    (a) => !isToday(parseISO(a.appointment_date)) && isFuture(parseISO(a.appointment_date))
  );

  if (loading) return <p className="text-muted-foreground font-body p-4">Loading…</p>;

  const AppointmentCard = ({ appt }: { appt: Appointment }) => {
    const cancellable = canCancel(appt);
    return (
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-foreground font-body text-sm font-medium">{appt.time_slot.slice(0, 5)}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-body ${
              appt.status === "booked" ? "bg-accent/20 text-accent" :
              appt.status === "completed" ? "bg-accent text-accent-foreground" :
              "bg-primary/20 text-primary"
            }`}>
              {appt.status}
            </span>
          </div>
          <p className="text-foreground font-body font-medium">{appt.client_name}</p>
          <p className="text-muted-foreground font-body text-sm">
            {appt.services?.name} — €{appt.services?.price?.toFixed(2)}
          </p>
        </div>
        {appt.status === "booked" && (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => updateStatus(appt.id, "completed")}
              className="bg-accent text-accent-foreground hover:bg-accent/80 font-body"
            >
              <Check size={14} className="mr-1" /> Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus(appt.id, "cancelled", appt)}
              className={`font-body ${cancellable
                ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                : "border-border text-muted-foreground/50 cursor-not-allowed"}`}
              title={!cancellable ? "Cannot cancel within 2 hours of appointment" : undefined}
            >
              <Ban size={14} className="mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus(appt.id, "no-show")}
              className="border-border text-foreground hover:bg-muted font-body"
            >
              <X size={14} className="mr-1" /> No-show
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-primary" /> Today
        </h3>
        {todayAppts.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm">No appointments today.</p>
        ) : (
          <div className="space-y-3">
            {todayAppts.map((a) => <AppointmentCard key={a.id} appt={a} />)}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Upcoming</h3>
        {upcomingAppts.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm">No upcoming appointments.</p>
        ) : (
          <div className="space-y-3">
            {upcomingAppts.map((a) => (
              <div key={a.id}>
                <p className="text-muted-foreground font-body text-xs mb-1">
                  {format(parseISO(a.appointment_date), "EEEE, dd MMM yyyy")}
                </p>
                <AppointmentCard appt={a} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleTab;
