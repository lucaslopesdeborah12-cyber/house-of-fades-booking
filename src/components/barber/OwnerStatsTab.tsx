import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, format, parseISO, subMonths, eachDayOfInterval, endOfWeek } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

const COMMISSION = 0.5;

type AppointmentRow = {
  id: string;
  barber_id: string;
  appointment_date: string;
  status: string;
  services: { name: string; price: number } | null;
  barbers: { name: string } | null;
};

const OwnerStatsTab = () => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, barber_id, appointment_date, status, services(name, price), barbers(name)")
        .eq("status", "completed");
      if (data) setAppointments(data as AppointmentRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <p className="text-muted-foreground font-body p-4">Loading stats…</p>;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const weekAppts = appointments.filter((a) => parseISO(a.appointment_date) >= weekStart);
  const monthAppts = appointments.filter((a) => parseISO(a.appointment_date) >= monthStart);

  // Per-barber stats
  const barberNames = [...new Set(appointments.map((a) => a.barbers?.name || "Unknown"))];

  const perBarber = barberNames.map((name) => {
    const mine = appointments.filter((a) => a.barbers?.name === name);
    const weekMine = mine.filter((a) => parseISO(a.appointment_date) >= weekStart);
    const monthMine = mine.filter((a) => parseISO(a.appointment_date) >= monthStart);
    const totalRevenue = mine.reduce((s, a) => s + (a.services?.price || 0), 0);
    return {
      name,
      weekCuts: weekMine.length,
      monthCuts: monthMine.length,
      allTimeCuts: mine.length,
      totalRevenue,
      earnings: totalRevenue * COMMISSION,
    };
  });

  const totalShopRevenue = appointments.reduce((s, a) => s + (a.services?.price || 0), 0);

  // Per-barber per service breakdown
  const serviceBreakdown = barberNames.flatMap((barber) => {
    const mine = appointments.filter((a) => a.barbers?.name === barber);
    const serviceMap = new Map<string, { count: number; revenue: number }>();
    mine.forEach((a) => {
      const sn = a.services?.name || "Unknown";
      const existing = serviceMap.get(sn) || { count: 0, revenue: 0 };
      serviceMap.set(sn, { count: existing.count + 1, revenue: existing.revenue + (a.services?.price || 0) });
    });
    return Array.from(serviceMap.entries()).map(([service, data]) => ({
      barber,
      service,
      count: data.count,
      revenue: data.revenue,
    }));
  });

  // Bar chart: cuts per day per barber (this week)
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: endOfWeek(now, { weekStartsOn: 1 }) });
  const dailyData = daysOfWeek.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const entry: Record<string, string | number> = { day: format(day, "EEE") };
    barberNames.forEach((name) => {
      entry[name] = appointments.filter(
        (a) => a.appointment_date === dayStr && a.barbers?.name === name
      ).length;
    });
    return entry;
  });

  // Line chart: monthly earnings over last 6 months
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(now, 5 - i);
    const mStr = format(m, "yyyy-MM");
    const label = format(m, "MMM");
    const entry: Record<string, string | number> = { month: label };
    barberNames.forEach((name) => {
      const earnings = appointments
        .filter((a) => a.appointment_date.startsWith(mStr) && a.barbers?.name === name)
        .reduce((s, a) => s + (a.services?.price || 0) * COMMISSION, 0);
      entry[name] = Math.round(earnings);
    });
    return entry;
  });

  const colors = ["#8B1A1A", "#4A7C2F", "#C4A35A"];

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Week" value={weekAppts.length} sub="cuts" />
        <StatCard label="This Month" value={monthAppts.length} sub="cuts" />
        <StatCard label="All Time" value={appointments.length} sub="cuts" />
        <StatCard label="Total Revenue" value={`€${totalShopRevenue.toFixed(0)}`} sub="all time" />
      </div>

      {/* Per barber summary */}
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Per Barber</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {perBarber.map((b) => (
            <div key={b.name} className="bg-card border border-border rounded-lg p-4">
              <h4 className="font-serif text-lg font-bold mb-2">{b.name}</h4>
              <div className="grid grid-cols-2 gap-2 font-body text-sm">
                <span className="text-muted-foreground">Week:</span><span className="text-foreground">{b.weekCuts} cuts</span>
                <span className="text-muted-foreground">Month:</span><span className="text-foreground">{b.monthCuts} cuts</span>
                <span className="text-muted-foreground">All time:</span><span className="text-foreground">{b.allTimeCuts} cuts</span>
                <span className="text-muted-foreground">Revenue:</span><span className="text-foreground">€{b.totalRevenue.toFixed(0)}</span>
                <span className="text-muted-foreground">Earnings (50%):</span><span className="text-accent font-medium">€{b.earnings.toFixed(0)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service breakdown */}
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Service Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-4">Barber</th>
                <th className="text-left py-2 pr-4">Service</th>
                <th className="text-right py-2 pr-4">Count</th>
                <th className="text-right py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {serviceBreakdown.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-foreground">{row.barber}</td>
                  <td className="py-2 pr-4 text-foreground">{row.service}</td>
                  <td className="py-2 pr-4 text-right text-foreground">{row.count}</td>
                  <td className="py-2 text-right text-foreground">€{row.revenue.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar chart */}
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Cuts Per Day (This Week)</h3>
        <div className="bg-card border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" stroke="#999" fontSize={12} />
              <YAxis stroke="#999" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#242424", border: "1px solid #333", color: "#F5F5F5" }} />
              <Legend />
              {barberNames.map((name, i) => (
                <Bar key={name} dataKey={name} fill={colors[i % colors.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Line chart */}
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Monthly Earnings (Last 6 Months)</h3>
        <div className="bg-card border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#999" fontSize={12} />
              <YAxis stroke="#999" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#242424", border: "1px solid #333", color: "#F5F5F5" }} />
              <Legend />
              {barberNames.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={colors[i % colors.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
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

export default OwnerStatsTab;
