import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfWeek, addDays, parseISO, endOfWeek } from "date-fns";
import { pt } from "date-fns/locale";
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

const ClientsTab = ({ barberId, isOwner }: { barberId: string; isOwner: boolean }) => {
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [cancelTarget, setCancelTarget] = useState<ClientAppointment | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const fetchAppointments = useCallback(async () => {
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addDays(weekStart, 6), "yyyy-MM-dd");

    let query = supabase
      .from("appointments")
      .select("id, appointment_date, time_slot, client_name, client_email, client_phone, status, barber_id, services(name), barbers(name)")
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .in("status", ["booked", "confirmed"])
      .neq("client_name", "BREAK")
      .order("appointment_date")
      .order("time_slot");

    if (!isOwner) {
      query = query.eq("barber_id", barberId);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load clients");
    } else {
      setAppointments((data as ClientAppointment[]) || []);
    }
    setLoading(false);
  }, [barberId, isOwner, weekStart]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`clients-${barberId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchAppointments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [barberId, fetchAppointments]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", cancelTarget.id);

    if (error) {
      toast.error("Failed to cancel");
    } else {
      toast.success("Agendamento cancelado");
      const timeSlot = cancelTarget.time_slot.slice(0, 5);
      notifyWaitingList(
        cancelTarget.barber_id,
        cancelTarget.appointment_date,
        timeSlot,
        cancelTarget.barbers?.name || ""
      );
      fetchAppointments();
    }
    setCancelTarget(null);
  };

  // Group by day
  const grouped = new Map<string, ClientAppointment[]>();
  for (let i = 0; i < 7; i++) {
    const dateStr = format(addDays(weekStart, i), "yyyy-MM-dd");
    grouped.set(dateStr, []);
  }
  appointments.forEach((a) => {
    const list = grouped.get(a.appointment_date);
    if (list) list.push(a);
  });

  if (loading) return <p className="text-muted-foreground font-body text-sm p-4">Loading…</p>;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm font-body text-muted-foreground">
          {format(weekStart, "dd/MM")} — {format(addDays(weekStart, 6), "dd/MM")}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Day groups */}
      {Array.from(grouped.entries()).map(([dateStr, dayAppts], dayIndex) => (
        <div key={dateStr} className="space-y-2">
          <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border pb-1">
            {DAY_NAMES[dayIndex]} — {format(parseISO(dateStr), "dd/MM")}
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

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
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
