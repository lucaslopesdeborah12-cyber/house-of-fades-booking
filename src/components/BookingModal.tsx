import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  CalendarIcon,
  Clock,
  User,
  Scissors,
  X,
  Check,
  Calendar as CalendarDownloadIcon,
  Lock,
  Zap,
} from "lucide-react";
import emailjs from "@emailjs/browser";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import CountryCodeSelector, { COUNTRIES, formatPhoneForSubmit, type Country } from "@/components/CountryCodeSelector";
import WaitingListForm from "@/components/WaitingListForm";
import { notifyWaitingList } from "@/lib/waitingListNotifier";
import { downloadICS } from "@/lib/calendarDownload";

emailjs.init("TBNWeHLfrq6OuvZhQ");

type Barber = { id: string; name: string };
type Service = { id: string; name: string; price: number; duration_minutes: number };

const TIME_SLOTS = [
  "09:00",
  "09:20",
  "09:40",
  "10:00",
  "10:20",
  "10:40",
  "11:00",
  "11:20",
  "11:40",
  "12:00",
  "12:20",
  "12:40",
  "13:00",
  "13:20",
  "13:40",
  "14:00",
  "14:20",
  "14:40",
  "15:00",
  "15:20",
  "15:40",
  "16:00",
  "16:20",
  "16:40",
  "17:00",
  "17:20",
  "17:40",
  "18:00",
  "18:20",
  "18:40",
  "19:00",
];
const TOTAL_SLOTS = TIME_SLOTS.length;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedBarber?: string;
}

const BookingModal = ({ open, onOpenChange, preselectedBarber }: BookingModalProps) => {
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [monthAvailability, setMonthAvailability] = useState<Record<string, number>>({});
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [slotTakenMessage, setSlotTakenMessage] = useState("");
  const [waitingListOpen, setWaitingListOpen] = useState(false);
  const [contactPreferences, setContactPreferences] = useState<Set<"sms" | "email" | "call">>(new Set());
  const [prefShakeTriggered, setPrefShakeTriggered] = useState(false);
  const { t } = useLanguage();

  // Auto-fill name and email from logged-in user
  useEffect(() => {
    const fillFromAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (!clientEmail) setClientEmail(session.user.email || "");
        if (!clientName) {
          const meta = session.user.user_metadata;
          const name = meta?.full_name || meta?.name || "";
          if (name) setClientName(name);
        }
      }
    };
    if (open) fillFromAuth();
  }, [open]);

  const allSlotsBooked = selectedDate && bookedSlots.length >= TOTAL_SLOTS;
  const availableSlots = selectedDate ? TOTAL_SLOTS - bookedSlots.length : 0;
  const occupancyPercent = selectedDate ? (bookedSlots.length / TOTAL_SLOTS) * 100 : 0;

  const getUrgencyMessage = () => {
    if (!selectedDate || allSlotsBooked) return null;
    if (availableSlots === 1) return "🔥 Apenas 1 vaga restante!";
    if (availableSlots === 2) return "🔥 Apenas 2 vagas restantes!";
    if (occupancyPercent > 70) return "👀 Alta procura para este dia!";
    return null;
  };

  useEffect(() => {
    if (!open) return;
    supabase
      .from("barbers")
      .select("id, name")
      .then(({ data, error }) => {
        if (error) console.error("Barbers fetch error:", error);
        if (data && data.length > 0) {
          setBarbers(data);
          if (preselectedBarber) {
            const match = data.find((b) => b.name.toLowerCase() === preselectedBarber.toLowerCase());
            if (match) {
              setSelectedBarber(match.id);
              setStep(2);
            }
          }
        }
      });
    supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) console.error("Services fetch error:", error);
        if (data) setServices(data);
      });
  }, [open, preselectedBarber]);

  const fetchBookedSlots = useCallback(async () => {
    if (!selectedBarber || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("appointments")
      .select("time_slot")
      .eq("barber_id", selectedBarber)
      .eq("appointment_date", dateStr)
      .in("status", ["booked", "confirmed"]);
    if (error) return;
    const slots = (data || []).map((d) => d.time_slot.slice(0, 5));
    setBookedSlots(slots);
    if (selectedTime && slots.includes(selectedTime)) setSelectedTime("");
  }, [selectedBarber, selectedDate, selectedTime]);

  useEffect(() => {
    fetchBookedSlots();
  }, [selectedBarber, selectedDate]);

  const fetchMonthAvailability = useCallback(async () => {
    if (!open || step !== 3) return;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = format(new Date(year, month, 1), "yyyy-MM-dd");
    const lastDay = format(new Date(year, month + 1, 0), "yyyy-MM-dd");
    const query = supabase
      .from("appointments")
      .select("appointment_date, barber_id")
      .gte("appointment_date", firstDay)
      .lte("appointment_date", lastDay)
      .in("status", ["booked", "confirmed"]);
    if (selectedBarber) query.eq("barber_id", selectedBarber);
    const { data } = await query;
    if (!data) return;
    const countsByDate: Record<string, number> = {};
    if (selectedBarber) {
      data.forEach((row) => {
        const d = row.appointment_date;
        countsByDate[d] = (countsByDate[d] || 0) + 1;
      });
    } else {
      const byDateBarber: Record<string, Record<string, number>> = {};
      data.forEach((row) => {
        const d = row.appointment_date;
        const b = row.barber_id;
        if (!byDateBarber[d]) byDateBarber[d] = {};
        byDateBarber[d][b] = (byDateBarber[d][b] || 0) + 1;
      });
      Object.entries(byDateBarber).forEach(([date, barberCounts]) => {
        countsByDate[date] = Math.min(...Object.values(barberCounts));
      });
    }
    setMonthAvailability(countsByDate);
  }, [calendarMonth, open, selectedBarber, step]);

  useEffect(() => {
    fetchMonthAvailability();
  }, [fetchMonthAvailability]);

  useEffect(() => {
    if (!open) return;
    const monthFirstDay = format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1), "yyyy-MM-dd");
    const monthLastDay = format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0), "yyyy-MM-dd");
    const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
    const handleRealtimeAppointmentChange = (payload: any) => {
      const row = payload.new ?? payload.old;
      const appointmentDate = row?.appointment_date;
      const appointmentBarberId = row?.barber_id;
      if (!appointmentDate) return;
      const sameBarber = !selectedBarber || appointmentBarberId === selectedBarber;
      if (!sameBarber) return;
      if (selectedDateStr && appointmentDate === selectedDateStr) fetchBookedSlots();
      if (appointmentDate >= monthFirstDay && appointmentDate <= monthLastDay) fetchMonthAvailability();
    };
    const channel = supabase
      .channel(
        `booking-availability-${selectedBarber || "all"}-${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        handleRealtimeAppointmentChange,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments" },
        handleRealtimeAppointmentChange,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "appointments" },
        handleRealtimeAppointmentChange,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [calendarMonth, fetchBookedSlots, fetchMonthAvailability, open, selectedBarber, selectedDate]);

  const getDayAvailabilityClass = (date: Date): string => {
    if (date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0) return "";
    const key = format(date, "yyyy-MM-dd");
    const booked = monthAvailability[key] || 0;
    const ratio = booked / TOTAL_SLOTS;
    if (ratio >= 1) return "full";
    if (ratio >= 0.81) return "red";
    if (ratio >= 0.61) return "orange";
    if (ratio >= 0.41) return "yellow";
    return "green";
  };

  const reset = () => {
    setStep(1);
    setSelectedBarber("");
    setSelectedService("");
    setSelectedDate(undefined);
    setSelectedTime("");
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setSuccess(false);
    setContactPreferences(new Set());
    setPrefShakeTriggered(false);
    setSlotTakenMessage("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) {
      toast.error(t("booking.enterName"));
      return;
    }
    if (contactPreferences.size === 0) {
      toast.error("Escolha como quer receber a confirmação");
      return;
    }
    if (!clientEmail.trim()) {
      toast.error(t("booking.enterEmail"));
      return;
    }
    if (!clientPhone.trim()) {
      toast.error("Introduza o seu telefone");
      return;
    }
    const barberNameForEmail = barbers.find((b) => b.id === selectedBarber)?.name || "";
    const serviceObjForEmail = services.find((s) => s.id === selectedService);
    const serviceNameForEmail = serviceObjForEmail?.name || "";
    const servicePriceForEmail = `€${Number(serviceObjForEmail?.price || 0).toFixed(0)}`;
    const dateForEmail = format(selectedDate!, "dd/MM/yyyy");
    setSubmitting(true);
    const { data: bookResult, error } = await supabase.functions.invoke("book-appointment", {
      body: {
        barber_id: selectedBarber,
        service_id: selectedService,
        appointment_date: format(selectedDate!, "yyyy-MM-dd"),
        time_slot: selectedTime,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : null,
        client_email: clientEmail.trim() || null,
        contact_preference: Array.from(contactPreferences).join(",") || "sms",
      },
    });
    setSubmitting(false);
    if (error || (bookResult && bookResult.error)) {
      // If slot was taken by another client, go back to time selection
      if (bookResult?.slot_taken) {
        setSelectedTime("");
        setSlotTakenMessage("Este horário acabou de ser reservado. Escolha outro horário.");
        setStep(3);
        fetchBookedSlots();
      } else {
        const errMsg = bookResult?.error || t("booking.errorBooking");
        toast.error(errMsg);
        console.error(error || bookResult?.error);
      }
    } else {
      setSuccess(true);
      if (clientPhone.trim()) {
        supabase.functions
          .invoke("send-sms", {
            body: {
              action: "confirmation",
              phone: formatPhoneForSubmit(clientPhone, selectedCountry),
              clientName: clientName.trim(),
              barberName: barberNameForEmail,
              serviceName: serviceNameForEmail,
              date: dateForEmail,
              time: selectedTime,
            },
          })
          .catch(console.error);
      }
      const emailToSend = clientEmail.trim();
      if (emailToSend) {
        emailjs
          .send(
            "service_jq26o2f",
            "template_7i3p8r9",
            {
              to_name: clientName.trim(),
              to_email: emailToSend,
              date: dateForEmail,
              time: selectedTime,
              service: serviceNameForEmail,
              barber: barberNameForEmail,
              price: servicePriceForEmail,
              service_name: serviceNameForEmail,
              barber_name: barberNameForEmail,
              service_price: servicePriceForEmail,
              footer_note: "Enganou-se? Pode modificar ou cancelar a sua reserva respondendo a este email.",
            },
            "TBNWeHLfrq6OuvZhQ",
          )
          .catch(console.error);
      }
      supabase
        .from("owner_settings" as any)
        .select("value")
        .eq("key", "notification_email")
        .maybeSingle()
        .then(({ data }: any) => {
          if (data?.value) {
            emailjs
              .send(
                "service_jq26o2f",
                "template_7i3p8r9",
                {
                  to_name: "Owner",
                  to_email: data.value,
                  client_name: clientName.trim(),
                  client_email: clientEmail.trim() || "N/A",
                  client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : "N/A",
                  barber_name: barberNameForEmail,
                  service_name: serviceNameForEmail,
                  appointment_date: dateForEmail,
                  appointment_time: selectedTime,
                  service_price: servicePriceForEmail,
                  barber: barberNameForEmail,
                  service: serviceNameForEmail,
                  price: servicePriceForEmail,
                  date: dateForEmail,
                  time: selectedTime,
                },
                "TBNWeHLfrq6OuvZhQ",
              )
           .catch(console.error);
          }
        });

      // Bland.ai voice calls to client (confirmation + scheduled reminder)
      if (clientPhone.trim()) {
        supabase.functions
          .invoke("bland-call", {
            body: {
              clientName: clientName.trim(),
              clientPhone: formatPhoneForSubmit(clientPhone, selectedCountry),
              serviceName: serviceNameForEmail,
              barberName: barberNameForEmail,
              date: dateForEmail,
              time: selectedTime,
              appointmentDate: format(selectedDate!, "yyyy-MM-dd"),
            },
          })
          .catch(console.error);
      }
    }
  };

  const selectedBarberName = barbers.find((b) => b.id === selectedBarber)?.name;
  const selectedServiceObj = services.find((s) => s.id === selectedService);

  const handleDownloadCalendar = () => {
    if (!selectedDate || !selectedTime) return;
    downloadICS(
      format(selectedDate, "yyyy-MM-dd"),
      selectedTime,
      selectedBarberName || "Barber",
      selectedServiceObj?.name || "Haircut",
    );
  };

  const getGoogleCalendarUrl = () => {
    if (!selectedDate || !selectedTime) return "#";
    const [hour, minute] = selectedTime.split(":").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = format(selectedDate, "yyyyMMdd");
    const startStr = `${dateStr}T${pad(hour)}${pad(minute)}00`;
    const endH = minute + 30 >= 60 ? hour + 1 : hour;
    const endM = (minute + 30) % 60;
    const endStr = `${dateStr}T${pad(endH)}${pad(endM)}00`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${selectedServiceObj?.name || "Haircut"} - House of Fades`)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(`Appointment with ${selectedBarberName || "Barber"}`)}&location=${encodeURIComponent("House of Fades, Carlow, Ireland")}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#050505] border-[#c9a84c]/15 text-foreground w-full sm:w-[95vw] max-w-md max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6"
          style={{ borderRadius: 2 }}
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl italic" style={{ color: "#c9a84c" }}>
              {success ? "Reserva Confirmada" : t("booking.title")}
            </DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="py-8 space-y-6 relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
                <Check size={280} strokeWidth={0.5} className="text-[#c9a84c]" />
              </div>
              <div className="relative z-10">
                <h2 className="font-serif text-3xl italic text-[#c9a84c] mb-2">Até já, {clientName}.</h2>
                <p className="font-cormorant text-lg italic text-foreground/40">A sua reserva está confirmada.</p>
              </div>
              <div
                className="relative z-10 space-y-3"
                style={{ borderTop: "0.5px solid rgba(201,168,76,0.15)", paddingTop: 20 }}
              >
                <div
                  className="flex justify-between py-2"
                  style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
                >
                  <span className="font-sans text-[10px] font-light uppercase tracking-[0.2em] text-foreground/30">
                    Barbeiro
                  </span>
                  <span className="font-sans text-sm text-foreground/80">{selectedBarberName}</span>
                </div>
                <div
                  className="flex justify-between py-2"
                  style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
                >
                  <span className="font-sans text-[10px] font-light uppercase tracking-[0.2em] text-foreground/30">
                    Serviço
                  </span>
                  <span className="font-sans text-sm text-foreground/80">{selectedServiceObj?.name}</span>
                </div>
                <div
                  className="flex justify-between py-2"
                  style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
                >
                  <span className="font-sans text-[10px] font-light uppercase tracking-[0.2em] text-foreground/30">
                    Data
                  </span>
                  <span className="font-sans text-sm text-foreground/80">
                    {selectedDate && format(selectedDate, "dd/MM/yyyy")}
                  </span>
                </div>
                <div
                  className="flex justify-between py-2"
                  style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
                >
                  <span className="font-sans text-[10px] font-light uppercase tracking-[0.2em] text-foreground/30">
                    Hora
                  </span>
                  <span className="font-sans text-sm text-foreground/80">{selectedTime}</span>
                </div>
              </div>
              <div className="relative z-10 flex justify-end pt-4">
                <span className="font-cormorant text-5xl italic text-[#c9a84c]">
                  €{Number(selectedServiceObj?.price || 0).toFixed(0)}
                </span>
              </div>
              <div className="relative z-10 flex flex-col gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    const url = getGoogleCalendarUrl();
                    if (url && url !== "#") {
                      const w = window.open(url, "_blank");
                      if (!w) window.location.href = url;
                    }
                  }}
                  className="inline-flex items-center justify-center font-sans text-[11px] font-medium uppercase tracking-[0.15em] w-full h-12 px-4 text-[#050505]"
                  style={{ background: "#c9a84c", borderRadius: 0 }}
                >
                  <CalendarDownloadIcon size={14} className="mr-3" /> Adicionar ao Google Calendar
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCalendar()}
                  className="inline-flex items-center justify-center font-sans text-[11px] font-medium uppercase tracking-[0.15em] w-full h-12 px-4 text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors"
                  style={{ border: "0.5px solid rgba(201,168,76,0.3)", borderRadius: 0, background: "transparent" }}
                >
                  <CalendarDownloadIcon size={14} className="mr-3" /> Guardar no Apple Calendar
                </button>
                <button
                  onClick={reset}
                  className="font-sans text-[10px] font-light uppercase tracking-[0.15em] w-full h-10 text-foreground/30 hover:text-foreground/50 transition-colors"
                  style={{ border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 0, background: "transparent" }}
                >
                  Nova Reserva
                </button>
                <button
                  onClick={() => handleClose(false)}
                  className="font-sans text-[10px] text-foreground/20 hover:text-foreground/40 transition-colors mt-2"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={cn("h-[1px] flex-1 transition-colors", step >= s ? "bg-[#c9a84c]" : "bg-foreground/5")}
                  />
                ))}
              </div>

              {step === 1 &&
                (() => {
                  const barberRoles: Record<string, string> = {
                    John: "Senior Barber",
                    Mario: "Fade Specialist",
                    CJ: "Style Expert",
                  };
                  return (
                    <div>
                      <p className="font-sans text-[10px] font-light uppercase tracking-[0.3em] text-foreground/30 flex items-center gap-2 mb-6">
                        <User size={12} /> {t("booking.chooseBarber")}
                      </p>
                      <div style={{ padding: "4px 0 8px" }}>
                        {barbers.map((b, index) => {
                          const isSelected = selectedBarber === b.id;
                          const delays = [0.06, 0.16, 0.26];
                          return (
                            <button
                              key={b.id}
                              onClick={() => {
                                setSelectedBarber(b.id);
                                setStep(2);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                width: "100%",
                                padding: "16px 0",
                                borderBottom: index < barbers.length - 1 ? "0.5px solid rgba(201,168,76,0.08)" : "none",
                                borderLeft: "none",
                                borderRight: "none",
                                borderTop: "none",
                                background: "transparent",
                                cursor: "pointer",
                                position: "relative",
                                transition: "all 0.22s ease",
                                opacity: 0,
                                animation: `fadeUp 0.44s ease forwards`,
                                animationDelay: `${delays[index] || 0.06 + index * 0.1}s`,
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.paddingLeft = "8px";
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.paddingLeft = "0";
                              }}
                            >
                              <div
                                style={{
                                  flexShrink: 0,
                                  width: 44,
                                  height: 44,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 20,
                                  color: isSelected ? "#c9a84c" : "rgba(201,168,76,0.25)",
                                  fontFamily: "'Playfair Display', serif",
                                  fontStyle: "italic",
                                  fontWeight: "bold",
                                  border: isSelected ? "0.5px solid #c9a84c" : "0.5px solid rgba(201,168,76,0.1)",
                                  transition: "all 0.25s",
                                  borderRadius: 0,
                                }}
                              >
                                {b.name.charAt(0)}
                              </div>
                              <div style={{ flex: 1, textAlign: "left" }}>
                                <span
                                  style={{
                                    fontSize: 15,
                                    fontFamily: "'Playfair Display', serif",
                                    fontWeight: 600,
                                    letterSpacing: "0.3px",
                                    display: "block",
                                    ...(isSelected
                                      ? {
                                          background: "linear-gradient(90deg, #C9A84C, #f5e49c, #C9A84C)",
                                          backgroundSize: "300% auto",
                                          WebkitBackgroundClip: "text",
                                          WebkitTextFillColor: "transparent",
                                          animation: "shimmerGold 1.8s linear infinite",
                                        }
                                      : { color: "#e0e0e0" }),
                                  }}
                                >
                                  {b.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: "rgba(255,255,255,0.18)",
                                    fontFamily: "'Inter', sans-serif",
                                    fontWeight: 200,
                                    letterSpacing: "1.5px",
                                    textTransform: "uppercase" as const,
                                    marginTop: 3,
                                    display: "block",
                                  }}
                                >
                                  {barberRoles[b.name] || "Barber"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="font-sans text-[10px] font-light uppercase tracking-[0.3em] text-foreground/30 flex items-center gap-2">
                    <Scissors size={12} /> {t("booking.chooseService")}
                  </p>
                  <div style={{ padding: "4px 0 8px" }}>
                    {services.map((s, index) => {
                      const isSelected = selectedService === s.id;
                      const delays = [0.06, 0.14, 0.22, 0.3, 0.38];
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelectedService(s.id);
                            setSlotTakenMessage("");
                            setStep(3);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "8px 0",
                            position: "relative",
                            cursor: "pointer",
                            borderBottom: index < services.length - 1 ? "0.5px solid rgba(201,168,76,0.08)" : "none",
                            borderLeft: "none",
                            borderRight: "none",
                            borderTop: "none",
                            transition: "all 0.25s ease",
                            background: "transparent",
                            animation: `fadeUp 0.42s ease forwards`,
                            animationDelay: `${delays[index] || 0.06 + index * 0.08}s`,
                            opacity: 0,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: 200,
                                letterSpacing: "1.5px",
                                color: "rgba(201,168,76,0.25)",
                              }}
                            >
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div style={{ textAlign: "left" }}>
                              <span
                                style={{
                                  fontSize: 15,
                                  fontFamily: "'Playfair Display', serif",
                                  fontWeight: 600,
                                  color: isSelected ? "#c9a84c" : "#e0e0e0",
                                  display: "block",
                                  transition: "color 0.25s",
                                }}
                              >
                                {s.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "rgba(255,255,255,0.18)",
                                  fontFamily: "'Inter', sans-serif",
                                  fontWeight: 200,
                                  letterSpacing: "1px",
                                  display: "block",
                                  marginTop: 2,
                                }}
                              >
                                {s.duration_minutes} min
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 20,
                              fontFamily: "'Cormorant Garamond', serif",
                              fontStyle: "italic",
                              color: "#c9a84c",
                            }}
                          >
                            €{Number(s.price).toFixed(0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="font-sans text-[10px] font-light uppercase tracking-[0.2em] text-foreground/20 hover:text-foreground/40 transition-colors"
                  >
                    {t("booking.back")}
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  {slotTakenMessage && (
                    <div className="text-[#c9a84c] text-sm font-sans text-center py-2 px-3" style={{ border: "0.5px solid rgba(201,168,76,0.25)", background: "rgba(201,168,76,0.06)" }}>
                      {slotTakenMessage}
                    </div>
                  )}
                  <p className="font-sans text-[10px] font-light uppercase tracking-[0.3em] text-foreground/30 flex items-center gap-2">
                    <CalendarIcon size={12} /> {t("booking.chooseDateTime")}
                  </p>
                  <div
                    style={{
                      border: "0.5px solid rgba(201,168,76,0.1)",
                      borderRadius: 0,
                      background: "rgba(201,168,76,0.02)",
                    }}
                  >
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => setSelectedDate(date)}
                      onMonthChange={setCalendarMonth}
                      locale={pt}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0}
                      className={cn("p-3 pointer-events-auto w-full")}
                      formatters={{
                        formatCaption: (date) => {
                          const months = [
                            "Janeiro",
                            "Fevereiro",
                            "Março",
                            "Abril",
                            "Maio",
                            "Junho",
                            "Julho",
                            "Agosto",
                            "Setembro",
                            "Outubro",
                            "Novembro",
                            "Dezembro",
                          ];
                          return `${months[date.getMonth()]} ${date.getFullYear()}`;
                        },
                      }}
                      modifiers={{
                        gold: (date) => {
                          const cls = getDayAvailabilityClass(date);
                          return cls === "green" || cls === "yellow";
                        },
                        filling: (date) => getDayAvailabilityClass(date) === "orange",
                        almostFull: (date) => getDayAvailabilityClass(date) === "red",
                        full: (date) => getDayAvailabilityClass(date) === "full",
                      }}
                      modifiersClassNames={{
                        gold: "!text-[#c9a84c] !underline !underline-offset-4 !decoration-[#c9a84c]/30 !decoration-[0.5px]",
                        filling:
                          "!text-[#c9a84c]/70 !underline !underline-offset-4 !decoration-[#c9a84c]/20 !decoration-[0.5px]",
                        almostFull:
                          "!text-[#c9a84c]/50 !underline !underline-offset-4 !decoration-[#c9a84c]/15 !decoration-[0.5px]",
                        full: "!text-foreground/20 !line-through !opacity-50",
                      }}
                      classNames={{
                        day_selected: "!bg-[#c9a84c] !text-[#050505] !font-bold !rounded-none",
                        day_today: "!bg-transparent !text-[#c9a84c] !font-bold",
                        cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center font-sans text-[9px] font-light uppercase tracking-[0.15em] text-foreground/25">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-[1px] bg-[#c9a84c] inline-block" /> Disponível
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-[1px] bg-[#c9a84c]/60 inline-block" /> A encher
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-[1px] bg-[#c9a84c]/30 inline-block" /> Quase cheio
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-[1px] bg-foreground/15 inline-block" /> Últimas vagas
                    </span>
                  </div>
                  {selectedDate && (
                    <>
                      {getUrgencyMessage() && (
                        <div
                          className="text-center py-2 px-3"
                          style={{ border: "0.5px solid rgba(201,168,76,0.2)", borderRadius: 0 }}
                        >
                          <p className="font-sans text-[11px] font-light text-[#c9a84c]">{getUrgencyMessage()}</p>
                        </div>
                      )}
                      {allSlotsBooked ? (
                        <div className="flex flex-col items-center text-center gap-4 py-6">
                          <Lock size={24} className="text-foreground/20" />
                          <h3 className="font-serif text-lg italic text-[#c9a84c]">Dia esgotado</h3>
                          <p className="font-cormorant text-sm italic text-foreground/35 leading-relaxed">
                            Todas as vagas estão preenchidas — mas pode juntar-se à lista de espera.
                          </p>
                          <button
                            onClick={() => setWaitingListOpen(true)}
                            className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] w-full h-12 text-[#050505]"
                            style={{ background: "#c9a84c", borderRadius: 0 }}
                          >
                            Lista de Espera
                          </button>
                          <button
                            onClick={() => setSelectedDate(undefined)}
                            className="font-sans text-[10px] font-light uppercase tracking-[0.15em] text-foreground/25 hover:text-foreground/40 transition-colors"
                          >
                            Escolher outro dia
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-x-2 gap-y-0">
                          {TIME_SLOTS.map((tm) => {
                            const booked = bookedSlots.includes(tm);
                            const isSelected = selectedTime === tm;
                            return (
                              <button
                                key={tm}
                                disabled={booked}
                                onClick={() => setSelectedTime(tm)}
                                className="font-sans text-[12px] font-light transition-all py-3"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  borderBottom: isSelected ? "1px solid #c9a84c" : "1px solid transparent",
                                  color: booked
                                    ? "rgba(255,255,255,0.12)"
                                    : isSelected
                                      ? "#c9a84c"
                                      : "rgba(255,255,255,0.5)",
                                  cursor: booked ? "not-allowed" : "pointer",
                                  textDecoration: booked ? "line-through" : "none",
                                  letterSpacing: "0.5px",
                                  borderRadius: 0,
                                }}
                              >
                                {tm}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setStep(2)}
                      className="font-sans text-[10px] font-light uppercase tracking-[0.2em] text-foreground/20 hover:text-foreground/40 transition-colors"
                    >
                      {t("booking.back")}
                    </button>
                    {selectedDate && selectedTime && !allSlotsBooked && (
                      <button
                        onClick={() => setStep(4)}
                        className="ml-auto font-sans text-[11px] font-medium uppercase tracking-[0.2em] h-10 px-8 text-[#050505]"
                        style={{ background: "#c9a84c", borderRadius: 0 }}
                      >
                        {t("booking.continue")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 4 &&
                (() => {
                  const needsWarning = contactPreferences.size === 0 && clientName.length > 0;
                  if (needsWarning && !prefShakeTriggered) setPrefShakeTriggered(true);
                  const isConfirmDisabled =
                    submitting ||
                    !clientName.trim() ||
                    contactPreferences.size === 0 ||
                    !clientEmail.trim() ||
                    !clientPhone.trim();

                  const togglePref = (val: "sms" | "email" | "call") => {
                    setContactPreferences(prev => {
                      const next = new Set(prev);
                      if (next.has(val)) next.delete(val); else next.add(val);
                      return next;
                    });
                  };
                  const selectAll = () => {
                    setContactPreferences(new Set(["sms", "email", "call"]));
                  };
                  const allSelected = contactPreferences.has("sms") && contactPreferences.has("email") && contactPreferences.has("call");

                  return (
                    <div style={{ padding: "0 0 14px" }}>
                      <div
                        style={{
                          opacity: 0,
                          animation: "fadeUpForm 0.38s ease forwards",
                          animationDelay: "0.05s",
                          marginBottom: 18,
                        }}
                      >
                        {needsWarning && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "#c9a84c",
                              fontFamily: "'Inter', sans-serif",
                              fontWeight: 300,
                              marginBottom: 8,
                              animation: prefShakeTriggered ? "prefShake 0.4s ease" : "none",
                            }}
                          >
                            Escolha como quer receber a confirmação
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.25)",
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 200,
                            letterSpacing: "1px",
                            textTransform: "uppercase" as const,
                            marginBottom: 10,
                          }}
                        >
                          Forma de confirmação
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {([
                            { value: "sms" as const, label: "SMS" },
                            { value: "email" as const, label: "Email" },
                            { value: "call" as const, label: "Ligação" },
                          ] as const).map((pill) => {
                            const isActive = contactPreferences.has(pill.value);
                            return (
                              <button
                                key={pill.value}
                                type="button"
                                onClick={() => togglePref(pill.value)}
                                style={{
                                  flex: 1,
                                  background: isActive ? "rgba(201,168,76,0.08)" : "transparent",
                                  border: `0.5px solid ${isActive ? "#c9a84c" : needsWarning ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.08)"}`,
                                  borderRadius: 0,
                                  padding: "10px 4px",
                                  fontSize: 10,
                                  color: isActive
                                    ? "#c9a84c"
                                    : needsWarning
                                      ? "rgba(201,168,76,0.5)"
                                      : "rgba(255,255,255,0.3)",
                                  fontFamily: "'Inter', sans-serif",
                                  fontWeight: isActive ? 400 : 200,
                                  letterSpacing: "1px",
                                  textTransform: "uppercase" as const,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  transition: "all 0.22s",
                                  animation: needsWarning && !isActive ? "prefPulse 1.5s ease infinite" : "none",
                                }}
                              >
                                {pill.label}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={selectAll}
                            style={{
                              flex: 1,
                              background: allSelected ? "rgba(201,168,76,0.08)" : "transparent",
                              border: `0.5px solid ${allSelected ? "#c9a84c" : needsWarning ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.08)"}`,
                              borderRadius: 0,
                              padding: "10px 4px",
                              fontSize: 10,
                              color: allSelected
                                ? "#c9a84c"
                                : needsWarning
                                  ? "rgba(201,168,76,0.5)"
                                  : "rgba(255,255,255,0.3)",
                              fontFamily: "'Inter', sans-serif",
                              fontWeight: allSelected ? 400 : 200,
                              letterSpacing: "1px",
                              textTransform: "uppercase" as const,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "all 0.22s",
                              animation: needsWarning && !allSelected ? "prefPulse 1.5s ease infinite" : "none",
                            }}
                          >
                            Todos
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          marginBottom: 14,
                          opacity: 0,
                          animation: "fadeUpForm 0.42s ease forwards",
                          animationDelay: "0.12s",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            color: "rgba(201,168,76,0.4)",
                            letterSpacing: 2,
                            textTransform: "uppercase" as const,
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 200,
                          }}
                        >
                          Nome
                        </span>
                        <input
                          placeholder="Nome completo *"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          style={{
                            background: "transparent",
                            borderBottom: "0.5px solid rgba(201,168,76,0.15)",
                            borderTop: "none",
                            borderLeft: "none",
                            borderRight: "none",
                            borderRadius: 0,
                            padding: "12px 0",
                            fontSize: "16px",
                            color: "#e0e0e0",
                            outline: "none",
                            width: "100%",
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 300,
                            WebkitTextSizeAdjust: "none",
                            touchAction: "manipulation",
                            transition: "border-color 0.2s",
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderBottomColor = "#c9a84c";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderBottomColor = "rgba(201,168,76,0.15)";
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          marginBottom: 14,
                          opacity: 0,
                          animation: "fadeUpForm 0.42s ease forwards",
                          animationDelay: "0.18s",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            color: "rgba(201,168,76,0.4)",
                            letterSpacing: 2,
                            textTransform: "uppercase" as const,
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 200,
                          }}
                        >
                          Email
                        </span>
                        <input
                          placeholder="Email *"
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          style={{
                            background: "transparent",
                            borderBottom: "0.5px solid rgba(201,168,76,0.15)",
                            borderTop: "none",
                            borderLeft: "none",
                            borderRight: "none",
                            borderRadius: 0,
                            padding: "12px 0",
                            fontSize: "16px",
                            color: "#c9a84c",
                            outline: "none",
                            width: "100%",
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 300,
                            WebkitTextSizeAdjust: "none",
                            touchAction: "manipulation",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          marginBottom: 18,
                          opacity: 0,
                          animation: "fadeUpForm 0.42s ease forwards",
                          animationDelay: "0.21s",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            color: "rgba(201,168,76,0.4)",
                            letterSpacing: 2,
                            textTransform: "uppercase" as const,
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 200,
                          }}
                        >
                          Telefone
                        </span>
                        <div
                          style={{
                            display: "flex",
                            borderBottom: "0.5px solid rgba(201,168,76,0.15)",
                            transition: "border-color 0.2s",
                          }}
                          onFocus={(e) => {
                            (e.currentTarget as HTMLElement).style.borderBottomColor = "#c9a84c";
                          }}
                          onBlur={(e) => {
                            (e.currentTarget as HTMLElement).style.borderBottomColor = "rgba(201,168,76,0.15)";
                          }}
                        >
                          <div style={{ flexShrink: 0 }}>
                            <CountryCodeSelector selected={selectedCountry} onSelect={setSelectedCountry} />
                          </div>
                          <input
                            placeholder={selectedCountry.code === "IE" ? "085 123 4567" : t("booking.phone")}
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value.replace(/[^0-9]/g, ""))}
                            style={{
                              flex: 1,
                              background: "transparent",
                              border: "none",
                              outline: "none",
                              padding: "12px 10px",
                              fontSize: "16px",
                              color: "#e0e0e0",
                              fontFamily: "'Inter', sans-serif",
                              fontWeight: 300,
                              WebkitTextSizeAdjust: "none",
                              touchAction: "manipulation",
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          opacity: 0,
                          animation: "fadeUpForm 0.4s ease forwards",
                          animationDelay: "0.26s",
                          borderTop: "0.5px solid rgba(201,168,76,0.1)",
                          paddingTop: 18,
                          marginBottom: 18,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            color: "rgba(201,168,76,0.35)",
                            letterSpacing: 2,
                            textTransform: "uppercase" as const,
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 200,
                            marginBottom: 12,
                          }}
                        >
                          Resumo
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                          <div>
                            <div
                              style={{
                                fontSize: 14,
                                color: "#e0e0e0",
                                fontFamily: "'Playfair Display', serif",
                                fontWeight: 600,
                                marginBottom: 4,
                              }}
                            >
                              {selectedServiceObj?.name || ""}{" "}
                              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span> {selectedBarberName || ""}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.25)",
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: 200,
                              }}
                            >
                              {selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""} às {selectedTime}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 28,
                              fontFamily: "'Cormorant Garamond', serif",
                              fontStyle: "italic",
                              color: "#c9a84c",
                            }}
                          >
                            €{Number(selectedServiceObj?.price || 0).toFixed(0)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleSubmit}
                        disabled={isConfirmDisabled}
                        style={{
                          opacity: 0,
                          animation: "fadeUpForm 0.42s ease forwards",
                          animationDelay: "0.34s",
                          background: "#c9a84c",
                          border: "none",
                          borderRadius: 0,
                          padding: 16,
                          width: "100%",
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#050505",
                          fontFamily: "'Inter', sans-serif",
                          letterSpacing: "3px",
                          textTransform: "uppercase" as const,
                          cursor: isConfirmDisabled ? "not-allowed" : "pointer",
                          ...(isConfirmDisabled ? { filter: "opacity(0.4)" } : {}),
                        }}
                      >
                        {submitting ? t("booking.confirming") : "CONFIRMAR RESERVA"}
                      </button>
                      <div
                        onClick={() => setStep(3)}
                        style={{
                          textAlign: "center",
                          padding: "12px 0 2px",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.15)",
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 200,
                          letterSpacing: "1px",
                        }}
                      >
                        ← Voltar
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedDate && selectedBarber && (
        <WaitingListForm
          open={waitingListOpen}
          onOpenChange={setWaitingListOpen}
          date={selectedDate}
          barberId={selectedBarber}
          barberName={selectedBarberName || ""}
        />
      )}
    </>
  );
};

export default BookingModal;
