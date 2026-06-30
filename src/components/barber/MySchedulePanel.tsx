import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, subWeeks, addWeeks, isToday, parseISO, isBefore, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Trash2, Coffee, Ban, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { useShopSettings, getDayCount, generateTimeSlots } from "@/hooks/useShopSettings";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  barberId: string;
}

const GOLD = "#c9a84c";
const RED = "#ff4444";

const MySchedulePanel = ({ barberId }: Props) => {
  const { t } = useLanguage();
  const { settings, loading: settingsLoading } = useShopSettings();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(0);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const dayCount = getDayCount(settings.last_working_day);
  const timeSlots = generateTimeSlots(settings.work_start, settings.work_end);
  const dayNames = [0,1,2,3,4,5,6].map(i => t(`schedule.dayShort${i}`)).slice(0, dayCount);
  const weekDays = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const selectedDate = weekDays[selectedDay] || weekDays[0];
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const isPastDay = isBefore(startOfDay(selectedDate), startOfDay(new Date()));

  const fetchAppointments = useCallback(async () => {
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addDays(weekStart, dayCount - 1), "yyyy-MM-dd");
    const { data } = await supabase
      .from("appointments")
      .select("id, appointment_date, time_slot, client_name, status")
      .eq("barber_id", barberId)
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .in("status", ["booked", "confirmed"])
      .order("time_slot");
    setAppointments(data || []);
    setLoading(false);
  }, [barberId, weekStart, dayCount]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    const todayIdx = weekDays.findIndex(d => isToday(d));
    setSelectedDay(todayIdx >= 0 ? todayIdx : 0);
  }, [weekStart, dayCount]);

  const dayAppointments = appointments.filter(a => a.appointment_date === selectedDateStr);
  const breaks = dayAppointments.filter(a => a.client_name === "BREAK");
  const blocks = dayAppointments.filter(a => a.client_name === "BLOCKED");
  const isDayOff = dayAppointments.some(a => a.client_name === "DAYOFF");
  const occupiedSlots = dayAppointments.map(a => a.time_slot.slice(0, 5));
  const freeSlots = timeSlots.filter(t => !occupiedSlots.includes(t));

  const addBreak = async (time: string) => {
    if (occupiedSlots.includes(time)) {
      toast.error(t("schedule.toastSlotTaken"));
      return;
    }

    const { data: services, error: serviceError } = await supabase
      .from("services")
      .select("id")
      .limit(1);

    if (serviceError || !services?.length) {
      console.error("Failed to load service for break:", serviceError);
      toast.error(t("schedule.toastFailedAddBreak"));
      return;
    }

    const breakInsert = {
      barber_id: barberId,
      service_id: services[0].id,
      appointment_date: selectedDateStr,
      time_slot: `${time}:00`,
      client_name: "BREAK",
      client_phone: null,
      client_email: null,
      contact_preference: "both",
      status: "booked",
    };

    console.log("Break insert payload:", breakInsert);
    const { error } = await supabase.from("appointments").insert(breakInsert);
    if (error) {
      console.error("Break insert error:", error);
      toast.error(t("schedule.toastFailedAddBreak"));
      return;
    }
    toast.success(t("schedule.toastBreakAdded"));
    fetchAppointments();
  };

  const addBlock = async (startTime: string, endTime: string) => {
    const startIdx = timeSlots.indexOf(startTime);
    const endIdx = timeSlots.indexOf(endTime);
    if (startIdx < 0 || endIdx < 0 || startIdx >= endIdx) {
      toast.error(t("schedule.toastInvalidRange"));
      return;
    }
    const slotsToBlock = timeSlots.slice(startIdx, endIdx);
    const available = slotsToBlock.filter(t => !occupiedSlots.includes(t));
    if (available.length === 0) { toast.error(t2("schedule.toastAllTaken")); return; }

    const inserts = available.map(t => ({
      barber_id: barberId,
      appointment_date: selectedDateStr,
      time_slot: `${t}:00`,
      client_name: "BLOCKED" as const,
      status: "booked" as const,
      client_phone: null,
      client_email: null,
      service_id: null,
    }));

    const { error } = await supabase.from("appointments").insert(inserts);
    if (error) { toast.error(t2("schedule.toastFailedBlock")); return; }
    toast.success(t2("schedule.toastSlotsBlocked").replace("{n}", String(available.length)));
    fetchAppointments();
  };

  const toggleDayOff = async () => {
    if (isDayOff) {
      // Remove day off
      const dayOffIds = dayAppointments.filter(a => a.client_name === "DAYOFF").map(a => a.id);
      for (const id of dayOffIds) {
        await supabase.from("appointments").delete().eq("id", id);
      }
      toast.success("Dia de folga removido");
    } else {
      // Check for client bookings
      const clientBookings = dayAppointments.filter(a => !["BREAK", "BLOCKED", "DAYOFF"].includes(a.client_name));
      if (clientBookings.length > 0) {
        toast.error("Existem agendamentos de clientes neste dia. Cancele-os primeiro.");
        return;
      }
      // Remove existing breaks/blocks
      const toRemove = dayAppointments.filter(a => ["BREAK", "BLOCKED"].includes(a.client_name));
      for (const a of toRemove) {
        await supabase.from("appointments").delete().eq("id", a.id);
      }
      // Insert day off marker
      const { error } = await supabase.from("appointments").insert({
        barber_id: barberId,
        appointment_date: selectedDateStr,
        time_slot: `${settings.work_start}:00`,
        client_name: "DAYOFF",
        status: "booked",
        client_phone: null,
        client_email: null,
        service_id: null,
      });
      if (error) { toast.error("Erro ao marcar folga"); return; }
      toast.success("Dia marcado como folga");
    }
    fetchAppointments();
  };

  const removeSlot = async (id: string) => {
    await supabase.from("appointments").delete().eq("id", id);
    toast.success("Removido");
    fetchAppointments();
  };

  // Block range state
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");

  if (settingsLoading || loading) {
    return <p className="text-muted-foreground font-body p-4">A carregar…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {weekDays.map((day, index) => {
          const active = index === selectedDay;
          const today = isToday(day);
          const hasDayOff = appointments.some(a => a.appointment_date === format(day, "yyyy-MM-dd") && a.client_name === "DAYOFF");
          return (
            <button
              key={index}
              onClick={() => setSelectedDay(index)}
              className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-4 py-2 min-w-[56px] transition-colors relative ${
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : today
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card text-muted-foreground border border-border"
              }`}
            >
              <span className="text-[10px] font-body uppercase tracking-wider">{dayNames[index]}</span>
              <span className="text-lg font-bold font-body">{format(day, "d")}</span>
              {hasDayOff && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: RED }} />}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground font-body">
        {format(selectedDate, "EEEE, dd/MM/yyyy")}
      </p>

      {isPastDay ? (
        <div className="text-center py-8 text-muted-foreground/60 font-body text-sm">
          Não é possível editar dias passados.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Day OFF toggle */}
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarOff size={16} style={{ color: isDayOff ? RED : undefined }} />
                <span className="font-body text-sm font-medium">Dia de Folga</span>
              </div>
              <Button
                size="sm"
                variant={isDayOff ? "destructive" : "outline"}
                onClick={toggleDayOff}
                className="font-body text-xs"
                style={isDayOff ? { background: RED } : {}}
              >
                {isDayOff ? "Remover Folga" : "Marcar Folga"}
              </Button>
            </div>
          </div>

          {!isDayOff && (
            <>
              {/* Breaks section */}
              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coffee size={16} style={{ color: GOLD }} />
                    <span className="font-body text-sm font-medium" style={{ color: GOLD }}>Pausas</span>
                  </div>
                </div>

                {breaks.length > 0 && (
                  <div className="space-y-1">
                    {breaks.map(b => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}>
                        <span className="font-body text-sm" style={{ color: GOLD }}>{b.time_slot.slice(0, 5)}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeSlot(b.id)}>
                          <Trash2 size={14} style={{ color: RED }} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {freeSlots.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(v) => addBreak(v)}>
                      <SelectTrigger className="flex-1 bg-background border-border text-foreground font-body text-sm h-9">
                        <SelectValue placeholder="Adicionar pausa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {freeSlots.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Block section */}
              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ban size={16} style={{ color: RED }} />
                    <span className="font-body text-sm font-medium" style={{ color: RED }}>Bloquear Intervalo</span>
                  </div>
                </div>

                {blocks.length > 0 && (
                  <div className="space-y-1">
                    {blocks.map(b => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)" }}>
                        <span className="font-body text-sm" style={{ color: RED }}>{b.time_slot.slice(0, 5)} — Bloqueado</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeSlot(b.id)}>
                          <Trash2 size={14} style={{ color: RED }} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Select value={blockStart} onValueChange={setBlockStart}>
                    <SelectTrigger className="flex-1 bg-background border-border text-foreground font-body text-sm h-9">
                      <SelectValue placeholder="De" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-sm">→</span>
                  <Select value={blockEnd} onValueChange={setBlockEnd}>
                    <SelectTrigger className="flex-1 bg-background border-border text-foreground font-body text-sm h-9">
                      <SelectValue placeholder="Até" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.filter(t => t > blockStart).map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="font-body text-xs shrink-0"
                    style={{ background: RED, color: "#fff" }}
                    disabled={!blockStart || !blockEnd}
                    onClick={() => {
                      addBlock(blockStart, blockEnd);
                      setBlockStart("");
                      setBlockEnd("");
                    }}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
              </div>

              {/* Day summary */}
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="font-body text-xs text-muted-foreground mb-2">Resumo do dia</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg py-2" style={{ background: "rgba(201,168,76,0.1)" }}>
                    <p className="text-lg font-bold font-body" style={{ color: GOLD }}>{breaks.length}</p>
                    <p className="text-[10px] font-body text-muted-foreground">Pausas</p>
                  </div>
                  <div className="rounded-lg py-2" style={{ background: "rgba(255,68,68,0.1)" }}>
                    <p className="text-lg font-bold font-body" style={{ color: RED }}>{blocks.length}</p>
                    <p className="text-[10px] font-body text-muted-foreground">Bloqueados</p>
                  </div>
                  <div className="rounded-lg py-2 bg-muted/20">
                    <p className="text-lg font-bold font-body text-green-500">{freeSlots.length}</p>
                    <p className="text-[10px] font-body text-muted-foreground">Livres</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MySchedulePanel;
