import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Key, Download, Calendar, X, Check } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth, eachDayOfInterval, endOfWeek, subMonths } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";

type Barber = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  commission_rate: number;
  photo_url: string | null;
  bio: string | null;
};

type AppointmentRow = {
  id: string;
  barber_id: string;
  appointment_date: string;
  time_slot: string;
  status: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  notes: string | null;
  services: { name: string; price: number } | null;
  barbers: { name: string; commission_rate: number } | null;
};

const BarberManagement = () => {
  const { t } = useLanguage();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee", commission_rate: 0.50 });
  const [loading, setLoading] = useState(false);

  const fetchBarbers = async () => {
    const { data } = await supabase.from("barbers").select("*").order("name");
    if (data) setBarbers(data as Barber[]);
  };

  useEffect(() => { fetchBarbers(); }, []);

  const createBarber = async () => {
    if (!form.name || !form.email || !form.password) { toast.error(t("admin.fillAllFields")); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "create-barber", ...form },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || t("admin.failedCreate"));
    } else {
      toast.success(t("admin.barberCreated"));
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "employee", commission_rate: 0.50 });
      fetchBarbers();
    }
  };

  const deleteBarber = async (userId: string, name: string) => {
    if (!confirm(t("admin.deleteConfirm").replace("{name}", name))) return;
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "delete-barber", userId },
    });
    if (error || data?.error) toast.error(t("admin.failedDelete"));
    else { toast.success(t("admin.deleted")); fetchBarbers(); }
  };

  const updateCommission = async (id: string, rate: number) => {
    await supabase.from("barbers").update({ commission_rate: rate }).eq("id", id);
    toast.success(t("admin.commissionUpdated"));
    fetchBarbers();
  };

  const resetPassword = async (userId: string) => {
    const newPass = prompt(t("admin.newPasswordPrompt"));
    if (!newPass || newPass.length < 6) return;
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "update-barber-password", userId, password: newPass },
    });
    if (error || data?.error) toast.error(t("admin.failed"));
    else toast.success(t("admin.passwordUpdated"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold">{t("admin.barberAccounts")}</h3>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-accent text-accent-foreground hover:bg-accent/80">
          <Plus size={16} className="mr-1" /> {t("admin.addBarber")}
        </Button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.emailLabel")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.password")}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.role")}</Label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm">
                <option value="employee">{t("admin.role.employee")}</option>
                <option value="owner">{t("admin.role.owner")}</option>
              </select>
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.commissionPct")}</Label>
              <Input type="number" step="0.01" min="0" max="1" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0.5 })} className="mt-1 bg-background border-border text-foreground" />
            </div>
          </div>
          <Button onClick={createBarber} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/80">
            {loading ? t("admin.creating") : t("admin.createBarber")}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {barbers.map((b) => (
          <div key={b.id} className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-foreground font-body font-medium">{b.name}</p>
              <p className="text-muted-foreground font-body text-sm">{b.email} • {b.role === "owner" ? t("admin.role.owner") : t("admin.role.employee")}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs font-body">{t("admin.commission")}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  defaultValue={b.commission_rate}
                  onBlur={(e) => updateCommission(b.id, parseFloat(e.target.value))}
                  className="w-20 bg-background border-border text-foreground text-sm"
                />
              </div>
              <Button size="sm" variant="ghost" onClick={() => resetPassword(b.user_id)} className="text-foreground"><Key size={14} /></Button>
              <Button size="sm" variant="ghost" onClick={() => deleteBarber(b.user_id, b.name)} className="text-primary"><Trash2 size={14} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ShopStats = () => {
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, services(name, price), barbers(name, commission_rate)")
        .eq("status", "completed");
      if (data) setAppointments(data as AppointmentRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <p className="text-muted-foreground font-body">{t("admin.loading")}</p>;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const barberNames = [...new Set(appointments.map((a) => a.barbers?.name || t("admin.unknown")))];
  const totalRevenue = appointments.reduce((s, a) => s + (a.services?.price || 0), 0);

  const dayCount: Record<string, number> = {};
  const timeCount: Record<string, number> = {};
  appointments.forEach((a) => {
    const dayName = format(parseISO(a.appointment_date), "EEEE");
    dayCount[dayName] = (dayCount[dayName] || 0) + 1;
    const hour = a.time_slot.slice(0, 5);
    timeCount[hour] = (timeCount[hour] || 0) + 1;
  });
  const busiestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
  const busiestTime = Object.entries(timeCount).sort((a, b) => b[1] - a[1])[0];

  const perBarber = barberNames.map((name) => {
    const mine = appointments.filter((a) => a.barbers?.name === name);
    const commission = mine[0]?.barbers?.commission_rate || 0.5;
    const revenue = mine.reduce((s, a) => s + (a.services?.price || 0), 0);
    return { name, cuts: mine.length, revenue, earnings: revenue * commission, commission };
  });

  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: endOfWeek(now, { weekStartsOn: 1 }) });
  const dailyData = daysOfWeek.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const entry: Record<string, string | number> = { day: format(day, "EEE") };
    barberNames.forEach((name) => {
      entry[name] = appointments.filter((a) => a.appointment_date === dayStr && a.barbers?.name === name).length;
    });
    return entry;
  });

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(now, 5 - i);
    const mStr = format(m, "yyyy-MM");
    const entry: Record<string, string | number> = { month: format(m, "MMM") };
    barberNames.forEach((name) => {
      const mine = appointments.filter((a) => a.appointment_date.startsWith(mStr) && a.barbers?.name === name);
      const commission = mine[0]?.barbers?.commission_rate || 0.5;
      entry[name] = Math.round(mine.reduce((s, a) => s + (a.services?.price || 0), 0) * commission);
    });
    return entry;
  });

  const colors = ["#8B1A1A", "#4A7C2F", "#C4A35A"];

  const exportCSV = () => {
    const headers = `${t("admin.barber")},${t("admin.cuts").replace(":","")},${t("admin.revenue").replace(":","")},${t("admin.earnings").replace(":","")},${t("admin.commission").replace(":","")}\n`;
    const rows = perBarber.map((b) => `${b.name},${b.cuts},€${b.revenue.toFixed(2)},€${b.earnings.toFixed(2)},${(b.commission * 100).toFixed(0)}%`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shop-stats-${format(now, "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold">{t("admin.shopStatistics")}</h3>
        <Button size="sm" onClick={exportCSV} className="bg-primary text-primary-foreground hover:bg-primary/80">
          <Download size={16} className="mr-1" /> {t("admin.exportCSV")}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("admin.totalRevenue")} value={`€${totalRevenue.toFixed(0)}`} sub={t("admin.allTime")} />
        <StatCard label={t("admin.totalCuts")} value={appointments.length} sub={t("admin.allTime")} />
        <StatCard label={t("admin.busiestDay")} value={busiestDay?.[0] ? (t(`day.${busiestDay[0]}`) !== `day.${busiestDay[0]}` ? t(`day.${busiestDay[0]}`) : busiestDay[0]) : "—"} sub={`${busiestDay?.[1] || 0} ${t("admin.cutsLower")}`} />
        <StatCard label={t("admin.busiestTime")} value={busiestTime?.[0] || "—"} sub={`${busiestTime?.[1] || 0} ${t("admin.cutsLower")}`} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {perBarber.map((b) => (
          <div key={b.name} className="bg-card border border-border rounded-lg p-4">
            <h4 className="font-serif text-lg font-bold mb-2">{b.name}</h4>
            <div className="grid grid-cols-2 gap-1 font-body text-sm">
              <span className="text-muted-foreground">{t("admin.cuts")}</span><span className="text-foreground">{b.cuts}</span>
              <span className="text-muted-foreground">{t("admin.revenue")}</span><span className="text-foreground">€{b.revenue.toFixed(0)}</span>
              <span className="text-muted-foreground">{t("admin.commission")}</span><span className="text-foreground">{(b.commission * 100).toFixed(0)}%</span>
              <span className="text-muted-foreground">{t("admin.earnings")}</span><span className="text-accent font-medium">€{b.earnings.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h4 className="font-serif text-lg font-semibold mb-3">{t("admin.revenuePerDay")}</h4>
        <div className="bg-card border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" stroke="#999" fontSize={12} />
              <YAxis stroke="#999" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#242424", border: "1px solid #333", color: "#F5F5F5" }} />
              <Legend />
              {barberNames.map((name, i) => <Bar key={name} dataKey={name} fill={colors[i % colors.length]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h4 className="font-serif text-lg font-semibold mb-3">{t("admin.monthlyEarnings")}</h4>
        <div className="bg-card border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#999" fontSize={12} />
              <YAxis stroke="#999" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#242424", border: "1px solid #333", color: "#F5F5F5" }} />
              <Legend />
              {barberNames.map((name, i) => <Line key={name} type="monotone" dataKey={name} stroke={colors[i % colors.length]} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const MasterCalendar = () => {
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [barbers, setBarbers] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; price: number }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newAppt, setNewAppt] = useState({ barber_id: "", service_id: "", client_name: "", client_email: "", client_phone: "", time_slot: "09:00" });

  const fetchAll = async () => {
    const [{ data: appts }, { data: b }, { data: s }] = await Promise.all([
      supabase.from("appointments").select("*, services(name, price), barbers(name, commission_rate)").eq("appointment_date", selectedDate).order("time_slot"),
      supabase.from("barbers").select("id, name"),
      supabase.from("services").select("id, name, price"),
    ]);
    if (appts) setAppointments(appts as AppointmentRow[]);
    if (b) setBarbers(b);
    if (s) setServices(s);
  };

  useEffect(() => { fetchAll(); }, [selectedDate]);

  const cancelAppt = async (id: string) => {
    await supabase.from("appointments").delete().eq("id", id);
    toast.success(t("admin.cancelledMsg"));
    fetchAll();
  };

  const completeAppt = async (id: string) => {
    await supabase.from("appointments").update({ status: "completed" }).eq("id", id);
    toast.success(t("admin.completedMsg"));
    fetchAll();
  };

  const addAppt = async () => {
    if (!newAppt.barber_id || !newAppt.service_id || !newAppt.client_name) { toast.error(t("admin.fillRequired")); return; }
    const { error } = await supabase.from("appointments").insert({
      ...newAppt,
      appointment_date: selectedDate,
      time_slot: newAppt.time_slot + ":00",
    });
    if (error) toast.error(error.message);
    else { toast.success(t("admin.appointmentAdded")); setShowAdd(false); fetchAll(); }
  };

  const statusLabel = (status: string) => {
    const key = `admin.status.${status}`;
    const v = t(key);
    return v === key ? status : v;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-serif text-xl font-semibold flex items-center gap-2">
          <Calendar size={20} className="text-primary" /> {t("admin.masterCalendar")}
        </h3>
        <div className="flex gap-2">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-background border-border text-foreground" />
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-accent text-accent-foreground hover:bg-accent/80">
            <Plus size={16} className="mr-1" /> {t("admin.add")}
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.barber")}</Label>
              <select value={newAppt.barber_id} onChange={(e) => setNewAppt({ ...newAppt, barber_id: e.target.value })} className="mt-1 w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm">
                <option value="">{t("admin.selectDots")}</option>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.service")}</Label>
              <select value={newAppt.service_id} onChange={(e) => setNewAppt({ ...newAppt, service_id: e.target.value })} className="mt-1 w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm">
                <option value="">{t("admin.selectDots")}</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} — €{s.price}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.clientName")}</Label>
              <Input value={newAppt.client_name} onChange={(e) => setNewAppt({ ...newAppt, client_name: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.time")}</Label>
              <Input type="time" value={newAppt.time_slot} onChange={(e) => setNewAppt({ ...newAppt, time_slot: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.emailLabel")}</Label>
              <Input value={newAppt.client_email} onChange={(e) => setNewAppt({ ...newAppt, client_email: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">{t("admin.phoneLabel")}</Label>
              <Input value={newAppt.client_phone} onChange={(e) => setNewAppt({ ...newAppt, client_phone: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
          </div>
          <Button onClick={addAppt} className="bg-accent text-accent-foreground hover:bg-accent/80">{t("admin.addAppointment")}</Button>
        </div>
      )}

      <div className="space-y-2">
        {appointments.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm py-8 text-center">{t("admin.noAppointments")}</p>
        ) : (
          appointments.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-body">
                  <span className="text-foreground font-medium">{a.time_slot.slice(0, 5)}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-foreground">{a.barbers?.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    a.status === "booked" ? "bg-accent/20 text-accent" :
                    a.status === "completed" ? "bg-accent text-accent-foreground" :
                    a.status === "cancelled" ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>{statusLabel(a.status)}</span>
                </div>
                <p className="text-foreground font-body text-sm">{a.client_name} — {a.services?.name}</p>
              </div>
              {a.status === "booked" && (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => completeAppt(a.id)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Check size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => cancelAppt(a.id)} className="text-primary"><X size={14} /></Button>
                </div>
              )}
            </div>
          ))
        )}
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

const EditBarberViewTab = () => {
  return (
    <div className="space-y-10">
      <BarberManagement />
      <hr className="border-border" />
      <ShopStats />
      <hr className="border-border" />
      <MasterCalendar />
    </div>
  );
};

export default EditBarberViewTab;
