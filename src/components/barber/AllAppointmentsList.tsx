import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notifyWaitingList } from "@/lib/waitingListNotifier";
import { format, parseISO, startOfWeek, endOfWeek, isToday } from "date-fns";
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

type AppointmentRow = {
  id: string;
  appointment_date: string;
  time_slot: string;
  client_name: string;
  status: string;
  barber_id: string;
  services: { name: string } | null;
  barbers: { name: string } | null;
};

type Filter = "all" | "today" | "week" | "upcoming";

const AllAppointmentsList = () => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, appointment_date, time_slot, client_name, status, barber_id, services(name), barbers(name)")
      .in("status", ["booked", "confirmed"])
      .neq("client_name", "BREAK")
      .order("appointment_date")
      .order("time_slot");

    if (error) {
      toast.error("Failed to load appointments");
    } else {
      setAppointments((data as AppointmentRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = appointments.filter((a) => {
    const d = parseISO(a.appointment_date);
    const today = new Date();
    if (filter === "today") return isToday(d);
    if (filter === "week") {
      const ws = startOfWeek(today, { weekStartsOn: 1 });
      const we = endOfWeek(today, { weekStartsOn: 1 });
      return d >= ws && d <= we;
    }
    if (filter === "upcoming") return d >= new Date(format(today, "yyyy-MM-dd"));
    return true;
  });

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const { error } = await supabase
      .from("appointments")
      .delete()
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
      fetchAll();
    }
    setCancelTarget(null);
  };

  const filters: { label: string; value: Filter }[] = [
    { label: "Todos", value: "all" },
    { label: "Hoje", value: "today" },
    { label: "Esta semana", value: "week" },
    { label: "Próximos", value: "upcoming" },
  ];

  if (loading) return <p className="text-muted-foreground font-body text-sm p-2">Loading…</p>;

  return (
    <div>
      <h3 className="font-serif text-xl font-semibold mb-4">Todos os Agendamentos</h3>

      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            className="font-body text-xs"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground font-body text-sm">Nenhum agendamento encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-3">Data</th>
                <th className="text-left py-2 pr-3">Hora</th>
                <th className="text-left py-2 pr-3">Cliente</th>
                <th className="text-left py-2 pr-3">Serviço</th>
                <th className="text-left py-2 pr-3">Barbeiro</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-right py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-foreground">{format(parseISO(a.appointment_date), "dd/MM")}</td>
                  <td className="py-2 pr-3 text-foreground">{a.time_slot.slice(0, 5)}</td>
                  <td className="py-2 pr-3 text-foreground">{a.client_name}</td>
                  <td className="py-2 pr-3 text-foreground">{a.services?.name || "—"}</td>
                  <td className="py-2 pr-3 text-foreground">{a.barbers?.name || "—"}</td>
                  <td className="py-2 pr-3 text-foreground capitalize">{a.status}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 font-body text-xs h-7"
                      onClick={() => setCancelTarget(a)}
                    >
                      Cancelar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
              className="bg-red-600 hover:bg-red-700 text-white font-body"
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

export default AllAppointmentsList;
