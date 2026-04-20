import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notifyWaitingList } from "@/lib/waitingListNotifier";
import { format, parseISO, startOfWeek, endOfWeek, isToday } from "date-fns";
import ContactClientModal, { ContactTarget } from "@/components/barber/ContactClientModal";
import CancelAppointmentModal, { CancelTarget } from "@/components/barber/CancelAppointmentModal";
import { AnimatePresence, motion } from "framer-motion";

type AppointmentRow = {
  id: string;
  appointment_date: string;
  time_slot: string;
  client_name: string;
  status: string;
  barber_id: string;
  client_email: string | null;
  client_phone: string | null;
  contact_preference: string | null;
  services: { name: string } | null;
  barbers: { name: string } | null;
};

type Filter = "all" | "today" | "week" | "upcoming";

const AllAppointmentsList = () => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, appointment_date, time_slot, client_name, status, barber_id, client_email, client_phone, contact_preference, services(name), barbers(name)")
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

  const handleCancelled = () => {
    if (!cancelTarget) return;
    const t = cancelTarget;
    const timeSlot = t.time_slot.slice(0, 5);
    notifyWaitingList(
      (appointments.find((a) => a.id === t.id)?.barber_id) || "",
      t.appointment_date,
      timeSlot,
      t.barbers?.name || ""
    );
    // Remove with fade-out (filter immediately; AnimatePresence handles exit)
    setAppointments((prev) => prev.filter((a) => a.id !== t.id));
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
              <AnimatePresence initial={false}>
              {filtered.map((a) => (
                <motion.tr
                  key={a.id}
                  layout
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="border-b border-border/50"
                >
                  <td className="py-2 pr-3 text-foreground">{format(parseISO(a.appointment_date), "dd/MM")}</td>
                  <td className="py-2 pr-3 text-foreground">{a.time_slot.slice(0, 5)}</td>
                  <td className="py-2 pr-3 text-foreground">{a.client_name}</td>
                  <td className="py-2 pr-3 text-foreground">{a.services?.name || "—"}</td>
                  <td className="py-2 pr-3 text-foreground">{a.barbers?.name || "—"}</td>
                  <td className="py-2 pr-3 text-foreground capitalize">{a.status}</td>
                  <td className="py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="font-body text-xs h-7 hover:bg-transparent"
                        style={{ color: "#c9a84c" }}
                        onClick={() => setContactTarget(a as ContactTarget)}
                      >
                        Contactar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 font-body text-xs h-7"
                        onClick={() => setCancelTarget(a as CancelTarget)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      <CancelAppointmentModal
        target={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={handleCancelled}
      />

      <ContactClientModal target={contactTarget} onClose={() => setContactTarget(null)} />
    </div>
  );
};

export default AllAppointmentsList;
