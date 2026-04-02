import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, parseISO } from "date-fns";

const COMMISSION = 0.5;

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  services: { name: string; price: number } | null;
};

const EmployeeStatsTab = ({ barberId }: { barberId: string }) => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, services(name, price)")
        .eq("barber_id", barberId)
        .eq("status", "completed");
      if (data) setAppointments(data as AppointmentRow[]);
      setLoading(false);
    };
    fetch();
  }, [barberId]);

  if (loading) return <p className="text-muted-foreground font-body p-4">Loading stats…</p>;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const weekAppts = appointments.filter((a) => parseISO(a.appointment_date) >= weekStart);
  const monthAppts = appointments.filter((a) => parseISO(a.appointment_date) >= monthStart);
  const totalRevenue = appointments.reduce((s, a) => s + (a.services?.price || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Week" value={weekAppts.length} sub="cuts" />
        <StatCard label="This Month" value={monthAppts.length} sub="cuts" />
        <StatCard label="All Time" value={appointments.length} sub="cuts" />
        <StatCard label="My Earnings" value={`€${(totalRevenue * COMMISSION).toFixed(0)}`} sub="all time (50%)" />
      </div>

      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Service Breakdown</h3>
        <div className="space-y-2">
          {(() => {
            const serviceMap = new Map<string, { count: number; revenue: number }>();
            appointments.forEach((a) => {
              const sn = a.services?.name || "Unknown";
              const existing = serviceMap.get(sn) || { count: 0, revenue: 0 };
              serviceMap.set(sn, { count: existing.count + 1, revenue: existing.revenue + (a.services?.price || 0) });
            });
            return Array.from(serviceMap.entries()).map(([service, data]) => (
              <div key={service} className="bg-card border border-border rounded-lg p-3 flex justify-between items-center font-body text-sm">
                <span className="text-foreground">{service}</span>
                <div className="text-right">
                  <span className="text-muted-foreground">{data.count} cuts</span>
                  <span className="text-foreground ml-3">€{(data.revenue * COMMISSION).toFixed(0)}</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub: string }) => (
  <div className="bg-card border border-border rounded-lg p-4 text-center">
    <p className="text-muted-foreground font-body text-xs uppercase tracking-wider">{label}</p>
    <p className="font-serif text-2xl font-bold mt-1">{value}</p>
    <p className="text-muted-foreground font-body text-xs">{sub}</p>
  </div>
);

export default EmployeeStatsTab;
