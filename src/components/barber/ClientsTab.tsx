import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, addDays, addWeeks, subWeeks, parseISO, endOfWeek } from "date-fns";
import { Phone, Mail, Trash2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
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
import { useLanguage } from "@/i18n/LanguageContext";

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

const getCurrentWeekMonday = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun,1=Mon...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

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
  const { t } = useLanguage();
  const DAY_NAMES = [
    t("staff.dayMonday"), t("staff.dayTuesday"), t("staff.dayWednesday"),
    t("staff.dayThursday"), t("staff.dayFriday"), t("staff.daySaturday"), t("staff.daySunday"),
  ];
  const { settings, loading: settingsLoading } = useShopSettings();
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getCurrentWeekMonday());
  const [cancelTarget, setCancelTarget] = useState<ClientAppointment | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const mountedRef = useRef(true);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Wait for auth session to be ready
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(() => {
      if (!cancelled) setAuthReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Stable fetch function using refs to avoid dependency issues
  const fetchAppointments = useCallback(async (targetWeekStart: Date) => {
    if (!mountedRef.current) return;

    const targetWeekEnd = endOfWeek(targetWeekStart, { weekStartsOn: 1 });
    const startStr = format(targetWeekStart, "yyyy-MM-dd");
    const endStr = format(targetWeekEnd, "yyyy-MM-dd");

    setLoading(true);
    setError(null);

    let query = supabase
      .from("appointments")
      .select("id, appointment_date, time_slot, client_name, client_email, client_phone, status, barber_id, services(name), barbers(name)")
      .gte("appointment_date", startStr)
      .lte("appointment_date", endStr)
      .in("status", ["booked", "confirmed"])
      .neq("client_name", "BREAK")
      .order("appointment_date")
      .order("time_slot");

    if (!isOwner) {
      query = query.eq("barber_id", barberId);
    }

    const { data, error: queryError } = await query;

    if (!mountedRef.current) return;

    if (queryError) {
      console.error("[ClientsTab] query error:", queryError);
      setError(t("staff.failedLoadClients"));
    } else {
      setAppointments((data as ClientAppointment[]) || []);
    }

    setLoading(false);
  }, [barberId, isOwner]);

  // Fetch when auth is ready and weekStart changes
  useEffect(() => {
    if (!authReady || settingsLoading) return;
    fetchAppointments(weekStart);
  }, [authReady, settingsLoading, weekStart, fetchAppointments]);

  // Reset to current week when tab becomes active
  useEffect(() => {
    if (activeTab !== "clients" || !authReady || settingsLoading) return;
    const monday = getCurrentWeekMonday();
    setWeekStart(monday);
  }, [activeTab, refreshToken, authReady, settingsLoading]);

  // Realtime subscription
  useEffect(() => {
    if (!authReady) return;

    const channel = supabase
      .channel(`clients-realtime-${barberId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          if (mountedRef.current) {
            fetchAppointments(weekStart);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberId, authReady, weekStart, fetchAppointments]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
      toast.error(t("staff.failedCancel"));
    } else {
      toast.success(t("staff.appointmentCancelled"));
      notifyWaitingList(barberIdForNotify, dateForNotify, timeSlot, barberName);
      fetchAppointments(weekStart);
    }

    setCancelTarget(null);
  };

  const goToPreviousWeek = () => setWeekStart((prev) => subWeeks(prev, 1));
  const goToNextWeek = () => setWeekStart((prev) => addWeeks(prev, 1));

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

  if (!authReady || settingsLoading) {
    return <p className="text-muted-foreground font-body text-sm p-4">{t("staff.loading")}</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <p className="text-destructive font-body text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={() => fetchAppointments(weekStart)}>
          <RefreshCw size={14} className="mr-1.5" /> {t("staff.tryAgain")}
        </Button>
      </div>
    );
  }

  if (loading) {
    return <p className="text-muted-foreground font-body text-sm p-4">{t("staff.loading")}</p>;
  }

  return (
    <div className="space-y-4">
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

      {Array.from(grouped.entries()).map(([dateStr, dayAppts]) => (
        <div key={dateStr} className="space-y-2">
          <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border pb-1">
            {DAY_NAMES[(parseISO(dateStr).getDay() + 6) % 7]} — {format(parseISO(dateStr), "dd/MM")}
          </h4>
          {dayAppts.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 font-body pl-2">{t("staff.noBookings")}</p>
          ) : (
            <div className="space-y-1.5">
              {dayAppts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
                  <span className="text-xs font-body text-muted-foreground w-12 text-right shrink-0">
                    {a.time_slot.slice(0, 5)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-medium text-foreground truncate">{a.client_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {a.services?.name && <span className="text-xs text-muted-foreground font-body">{a.services.name}</span>}
                      {isOwner && a.barbers?.name && <span className="text-xs text-primary/70 font-body">{a.barbers.name}</span>}
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
            <AlertDialogTitle className="font-serif">{t("staff.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {t("staff.cancelConfirm")}{" "}
              <span className="font-semibold text-foreground">{cancelTarget?.client_name}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">{t("staff.no")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-body"
              onClick={handleCancel}
            >
              {t("staff.yesCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientsTab;
