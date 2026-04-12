import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, endOfWeek } from "date-fns";
import { Phone, Mail, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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
import { notifyWaitingList } from "@/lib/waitingListNotifier";
import { useShopSettings } from "@/hooks/useShopSettings";

type ClientAppointment = {
  id: string;
  appointment_date: string;
  time_slot: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  status: string;
  barber_id: string;
  services: { name: string } | null;
  barbers: { name: string } | null;
};

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const ClientsTab = ({
  barberId,
  isOwner,
  activeTab,
  refreshToken,
}: {
  barberId: string;
  isOwner: boolean;
  activeTab?: string;
  refreshToken?: number;
}) => {
  const { loading: settingsLoading } = useShopSettings();
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [cancelTarget, setCancelTarget] = useState<ClientAppointment | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  const fetchAppointments = useCallback(async () => {
    console.log("[ClientsTab] fetching for range:", weekStartStr, "to", weekEndStr);

    let query = supabase
      .from("appointments")
      .select("id, appointment_date, time_slot, client_name, client_email, client_phone, status, barber_id, services(name), barbers(name)")
      .gte("appointment_date", weekStartStr)
      .lte("appointment_date", weekEndStr)
      .in("status", ["booked", "confirmed"])
      .neq("client_name", "BREAK")
      .order("appointment_date")
      .order("time_slot");

    if (!isOwner) {
      query = query.eq("barber_id", barberId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[ClientsTab] query error:", error);
      toast.error("Failed to load clients");
    } else {
      console.log("[ClientsTab] query result:", { from: weekStartStr, to: weekEndStr, count: data?.length ?? 0, data });
      setAppointments((data as ClientAppointment[]) || []);
    }

    setLoading(false);
  }, [barberId, isOwner, weekStartStr, weekEndStr]);

  // Fetch on mount and when week changes
  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  // Refetch when tab becomes active
  useEffect(() => {
    if (activeTab !== "clients") return;
    setLoading(true);
    fetchAppointments();
  }, [activeTab, refreshToken, fetchAppointments]);

  // Realtime subscription for INSERT/DELETE
  useEffect(() => {
    const channel = supabase
      .channel(`clients-realtime-${barberId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload: any) => {
          console.log("[ClientsTab] realtime event:", payload);
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberId, fetchAppointments]);

  const handleCancel = async () => {
    if (!cancelTarget) return;

    const timeSlot = cancelTarget.time_slot.slice(0, 5);
    const barberName = cancelTarget.barbers?.name || "";
    const barberIdForNotify = cancelTarget.barber_id;
    const dateForNotify = cancelTarget.appointment_date;

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", cancelTarget.id);

    if (error) {
      toast.error("Failed to cancel");
    } else {
      toast.success("Agendamento cancelado");
      notifyWaitingList(barberIdForNotify, dateForNotify, timeSlot, barberName);
      fetchAppointments();
    }

    setCancelTarget(null);
  };

  // Week navigation
  const goToPreviousWeek = () => setWeekStart((prev) => subWeeks(prev, 1));
  const goToNextWeek = () => setWeekStart((prev) => addWeeks(prev, 1));

  // Group by day
  const grouped = new Map<string, ClientAppointment[]>();
  for (let i = 0; i < 7; i++) {
    const dateStr = format(addDays(weekStart, i), "yyyy-MM-dd");
    grouped.set(dateStr, []);
  }

  appointments.forEach((appointment) => {
    const list = grouped.get(appointment.appointment_date);
    if (list) list.push(appointment);
  });

  if (loading || settingsLoading) {
    return <p className="text-muted-foreground font-body text-sm p-4">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousWeek}>
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm font-body text-muted-foreground">
          {format(weekStart, "dd/MM")} — {format(weekEnd, "dd/MM")}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Day groups */}
      {Array.from(grouped.entries()).map(([dateStr, dayAppts]) => (
        <div key={dateStr} className="space-y-2">
          <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border pb-1">
            {DAY_NAMES[(parseISO(dateStr).getDay() + 6) % 7]} — {format(parseISO(dateStr), "dd/MM")}
          </h4>
          {dayAppts.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 font-body pl-2">Sem agendamentos</p>
          ) : (
            <div className="space-y-1.5">
              {dayAppts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2"
                >
                  <span className="text-xs font-body text-muted-foreground w-12 text-right shrink-0">
                    {a.time_slot.slice(0, 5)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-medium text-foreground truncate">{a.client_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {a.services?.name && (
                        <span className="text-xs text-muted-foreground font-body">{a.services.name}</span>
                      )}
                      {isOwner && a.barbers?.name && (
                        <span className="text-xs text-primary/70 font-body">{a.barbers.name}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {a.client_email && (
                        <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
                          <Mail size={10} /> {a.client_email}
                        </span>
                      )}
                      {a.client_phone && (
                        <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
                          <Phone size={10} /> {a.client_phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 font-body text-xs h-8 shrink-0"
                    onClick={() => setCancelTarget(a)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

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
              onClick={handleCancel}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientsTab;
