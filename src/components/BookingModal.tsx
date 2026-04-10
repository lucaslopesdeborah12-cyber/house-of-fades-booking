import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, User, Scissors, X, Check, Calendar as CalendarDownloadIcon, Lock, Zap } from "lucide-react";
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

// Initialize EmailJS once
emailjs.init("TBNWeHLfrq6OuvZhQ");

type Barber = { id: string; name: string };
type Service = { id: string; name: string; price: number; duration_minutes: number };

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
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
  // calendarOpen removed — calendar is always inline
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [waitingListOpen, setWaitingListOpen] = useState(false);
  const [contactPreference, setContactPreference] = useState<'sms' | 'email' | 'call' | 'all' | null>(null);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [prefShakeTriggered, setPrefShakeTriggered] = useState(false);
  const { t } = useLanguage();

  const allSlotsBooked = selectedDate && bookedSlots.length >= TOTAL_SLOTS;

  // Urgency messages
  const availableSlots = selectedDate ? TOTAL_SLOTS - bookedSlots.length : 0;
  const occupancyPercent = selectedDate ? (bookedSlots.length / TOTAL_SLOTS) * 100 : 0;

  const getUrgencyMessage = () => {
    if (!selectedDate || allSlotsBooked) return null;
    if (availableSlots === 1) return "🔥 Only 1 spot left today!";
    if (availableSlots === 2) return "🔥 Only 2 spots left today!";
    if (occupancyPercent > 70) return "👀 High demand for this day!";
    return null;
  };

  // Fetch logged-in user email on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setLoggedInEmail(session.user.email);
        setClientEmail(session.user.email);
      } else {
        setLoggedInEmail(null);
        setClientEmail('');
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    supabase.from("barbers").select("id, name").then(({ data }) => {
      if (data) {
        setBarbers(data);
        if (preselectedBarber) {
          const match = data.find(b => b.name.toLowerCase() === preselectedBarber.toLowerCase());
          if (match) {
            setSelectedBarber(match.id);
            setStep(2);
          }
        }
      }
    });
    supabase.from("services").select("id, name, price, duration_minutes").order("created_at").then(({ data }) => {
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
    const slots = (data || []).map(d => d.time_slot.slice(0, 5));
    setBookedSlots(slots);
    if (selectedTime && slots.includes(selectedTime)) {
      setSelectedTime("");
    }
  }, [selectedBarber, selectedDate, selectedTime]);

  useEffect(() => {
    fetchBookedSlots();
  }, [selectedBarber, selectedDate]);

  useEffect(() => {
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

    if (selectedBarber) {
      query.eq("barber_id", selectedBarber);
    }

    query.then(({ data }) => {
      if (!data) return;
      const countsByDate: Record<string, number> = {};
      if (selectedBarber) {
        data.forEach(row => {
          const d = row.appointment_date;
          countsByDate[d] = (countsByDate[d] || 0) + 1;
        });
      } else {
        const byDateBarber: Record<string, Record<string, number>> = {};
        data.forEach(row => {
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
    });
  }, [open, step, selectedBarber, calendarMonth]);

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
    setContactPreference(null);
    setPrefShakeTriggered(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };


  const handleSubmit = async () => {
    if (!clientName.trim()) { toast.error(t("booking.enterName")); return; }
    if (contactPreference === null) { toast.error("Escolha como quer receber a confirmação"); return; }
    if ((contactPreference === 'email' || contactPreference === 'all') && !clientEmail.trim() && !loggedInEmail) { toast.error(t("booking.enterEmail")); return; }
    if ((contactPreference === 'sms' || contactPreference === 'call' || contactPreference === 'all') && !clientPhone.trim()) { toast.error("Introduza o seu telefone"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("appointments").insert({
      barber_id: selectedBarber,
      service_id: selectedService,
      appointment_date: format(selectedDate!, "yyyy-MM-dd"),
      time_slot: selectedTime,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : null,
      client_email: clientEmail.trim() || loggedInEmail || null,
      contact_preference: contactPreference || 'sms',
    });
    setSubmitting(false);
    if (error) {
      toast.error(t("booking.errorBooking"));
      console.error(error);
    } else {
      setSuccess(true);
      if (clientPhone.trim()) {
        supabase.functions.invoke("send-sms", {
          body: {
            action: "confirmation",
            phone: formatPhoneForSubmit(clientPhone, selectedCountry),
            clientName: clientName.trim(),
            barberName: selectedBarberName || "",
            serviceName: selectedServiceObj?.name || "",
            date: format(selectedDate!, "dd/MM/yyyy"),
            time: selectedTime,
          },
        }).catch(console.error);
      }
      const emailToSend = clientEmail.trim() || loggedInEmail;
      if (emailToSend) {
        emailjs.send(
          "service_jq26o2f",
          "template_7i3p8r9",
          {
            to_name: clientName.trim(),
            to_email: emailToSend,
            date: format(selectedDate!, "dd/MM/yyyy"),
            time: selectedTime,
            service: selectedServiceObj?.name || "",
            barber: selectedBarberName || "",
            price: `€${Number(selectedServiceObj?.price || 0).toFixed(0)}`,
          },
          "TBNWeHLfrq6OuvZhQ"
        ).catch((err) => console.error("EmailJS error:", err));
      }
      // Notify owner
      supabase
        .from("owner_settings" as any)
        .select("value")
        .eq("key", "notification_email")
        .maybeSingle()
        .then(({ data }: any) => {
          if (data?.value) {
            emailjs.send(
              "service_jq26o2f",
              "template_9wigrr6",
              {
                to_name: "Owner",
                to_email: data.value,
                client_name: clientName.trim(),
                client_email: clientEmail.trim(),
                client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : "N/A",
                barber_name: selectedBarberName || "",
                service_name: selectedServiceObj?.name || "",
                appointment_date: format(selectedDate!, "dd/MM/yyyy"),
                appointment_time: selectedTime,
                service_price: `€${Number(selectedServiceObj?.price || 0).toFixed(0)}`,
                date: format(selectedDate!, "dd/MM/yyyy"),
                time: selectedTime,
              },
              "TBNWeHLfrq6OuvZhQ"
            ).catch((err) => console.error("Owner notification error:", err));
          }
        });
    }
  };

  const selectedBarberName = barbers.find(b => b.id === selectedBarber)?.name;
  const selectedServiceObj = services.find(s => s.id === selectedService);

  const handleDownloadCalendar = () => {
    if (!selectedDate || !selectedTime) return;
    downloadICS(
      format(selectedDate, "yyyy-MM-dd"),
      selectedTime,
      selectedBarberName || "Barber",
      selectedServiceObj?.name || "Haircut"
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
    const title = encodeURIComponent(`${selectedServiceObj?.name || "Haircut"} - House of Fades`);
    const details = encodeURIComponent(`Appointment with ${selectedBarberName || "Barber"}`);
    const location = encodeURIComponent("House of Fades, Carlow, Ireland");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-card border-accent/20 text-foreground max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl gold-title-gradient">
              {success ? "🎉 Booking Confirmed!" : t("booking.title")}
            </DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
                <Check size={32} className="text-[#4A7C2F]" />
              </div>
              <p className="font-body text-foreground font-medium text-lg">{t("booking.successMsg")}</p>
              <div className="text-sm text-muted-foreground font-body space-y-1 bg-background/50 rounded-lg p-4 border border-border">
                <p><strong>{t("booking.barber")}</strong> {selectedBarberName}</p>
                <p><strong>{t("booking.service")}</strong> {selectedServiceObj?.name}</p>
                <p><strong>{t("booking.date")}</strong> {selectedDate && format(selectedDate, "dd/MM/yyyy")}</p>
                <p><strong>{t("booking.time")}</strong> {selectedTime}</p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-accent hover:bg-accent/90 text-background font-body w-full h-10 px-4 rounded-md text-sm font-medium"
                >
                  <CalendarDownloadIcon size={16} className="mr-2" /> Add to Google Calendar 📅
                </a>
                <Button
                  onClick={handleDownloadCalendar}
                  variant="outline"
                  className="font-body w-full border-border text-xs h-8"
                  size="sm"
                >
                  Download .ics (Apple Calendar)
                </Button>
                <Button
                  onClick={() => { reset(); }}
                  variant="outline"
                  className="font-body w-full border-border"
                >
                  Book Another Appointment
                </Button>
                <Button onClick={() => handleClose(false)} variant="ghost" className="text-muted-foreground font-body text-sm">
                  {t("booking.close")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", step >= s ? "bg-accent" : "bg-muted/30")} />
                ))}
              </div>

              {step === 1 && (() => {
                const barberRoles: Record<string, string> = {
                  'John': 'Senior Barber',
                  'Mario': 'Fade Specialist',
                  'CJ': 'Style Expert'
                };
                return (
                <div>
                  <p className="font-body text-sm text-muted-foreground flex items-center gap-2 mb-2"><User size={16} /> {t("booking.chooseBarber")}</p>
                  <div style={{ padding: "4px 0 8px" }}>
                    {barbers.map((b, index) => {
                      const isSelected = selectedBarber === b.id;
                      const delays = [0.06, 0.16, 0.26];
                      return (
                        <button
                          key={b.id}
                          onClick={() => { setSelectedBarber(b.id); setStep(2); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            width: "100%",
                            padding: "13px 16px",
                            borderBottom: index < barbers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            borderLeft: "none",
                            borderRight: "none",
                            borderTop: "none",
                            background: isSelected ? "rgba(201,168,76,0.05)" : "transparent",
                            cursor: "pointer",
                            position: "relative",
                            transition: "all 0.22s ease",
                            opacity: 0,
                            animation: `fadeUp 0.44s ease forwards`,
                            animationDelay: `${delays[index] || 0.06 + index * 0.1}s`,
                          }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,168,76,0.05)"; }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        >
                          {/* Avatar */}
                          <div style={{
                            flexShrink: 0,
                            width: 46,
                            height: 46,
                            borderRadius: 12,
                            background: isSelected ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.04)",
                            border: isSelected ? "1px solid #C9A84C" : "1px solid rgba(255,255,255,0.07)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            color: isSelected ? "#C9A84C" : "rgba(201,168,76,0.4)",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            transition: "all 0.25s",
                          }}>
                            {b.name.charAt(0)}
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, textAlign: "left" }}>
                            <span style={{
                              fontSize: 15,
                              fontWeight: "bold",
                              letterSpacing: "0.2px",
                              display: "block",
                              ...(isSelected ? {
                                background: "linear-gradient(90deg, #C9A84C, #f5e49c, #C9A84C)",
                                backgroundSize: "300% auto",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                animation: "shimmerGold 1.8s linear infinite",
                              } : {
                                color: "#e0e0e0",
                              }),
                            }}>{b.name}</span>
                            <span style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.22)",
                              fontFamily: "Arial",
                              marginTop: 3,
                              fontWeight: "normal",
                              display: "block",
                            }}>{barberRoles[b.name] || 'Barber'}</span>
                          </div>
                          {/* Dot */}
                          <div style={{
                            flexShrink: 0,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            border: "1.5px solid rgba(201,168,76,0.2)",
                            transition: "all 0.25s",
                            ...(isSelected ? {
                              background: "#C9A84C",
                              borderColor: "#C9A84C",
                              boxShadow: "0 0 6px rgba(201,168,76,0.4)",
                            } : {}),
                          }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><Scissors size={16} /> {t("booking.chooseService")}</p>
                  <div style={{ position: "relative", padding: "4px 0 8px" }}>
                    <div style={{ position: "absolute", right: 26, top: 14, bottom: 14, width: 1, background: "rgba(201,168,76,0.1)" }} />
                    {services.map((s, index) => {
                      const isSelected = selectedService === s.id;
                      const delays = [0.06, 0.14, 0.22, 0.30, 0.38];
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedService(s.id); setStep(3); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            padding: isSelected ? "13px 42px 13px 16px" : "13px 36px 13px 16px",
                            position: "relative",
                            cursor: "pointer",
                            borderBottom: index < services.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            borderLeft: "none",
                            borderRight: "none",
                            borderTop: "none",
                            transition: "all 0.25s ease",
                            background: isSelected ? "rgba(201,168,76,0.04)" : "transparent",
                            animation: `fadeUp 0.42s ease forwards`,
                            animationDelay: `${delays[index] || 0.06 + index * 0.08}s`,
                            opacity: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.paddingRight = "42px"; e.currentTarget.style.background = "rgba(201,168,76,0.04)"; }}
                          onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.paddingRight = "36px"; e.currentTarget.style.background = "transparent"; } }}
                        >
                          <span style={{ flex: 1, fontSize: 14, color: isSelected ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "0.2px", textAlign: "left" }} className="font-body">
                            {s.name}
                          </span>
                          <div style={{ textAlign: "right", marginRight: 12, flexShrink: 0 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 2, fontFamily: "Arial" }}>
                              {s.duration_minutes} min
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: "bold",
                                ...(isSelected
                                  ? {
                                      background: "linear-gradient(90deg, #C9A84C, #f5e49c, #C9A84C)",
                                      backgroundSize: "300% auto",
                                      WebkitBackgroundClip: "text",
                                      WebkitTextFillColor: "transparent",
                                      animation: "shimmerGold 2s linear infinite",
                                    }
                                  : { color: "#C9A84C" }),
                              }}
                            >
                              €{Number(s.price).toFixed(0)}
                            </div>
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              right: 22,
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              border: isSelected ? "1.5px solid #C9A84C" : "1.5px solid rgba(201,168,76,0.25)",
                              background: isSelected ? "#C9A84C" : "#0e0e0e",
                              transition: "all 0.25s",
                              transform: isSelected ? "scale(1.35)" : "scale(1)",
                              boxShadow: isSelected ? "0 0 6px rgba(201,168,76,0.4)" : "none",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground font-body text-sm">{t("booking.back")}</Button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><CalendarIcon size={16} /> {t("booking.chooseDateTime")}</p>

                  {/* Inline calendar — always visible */}
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => setSelectedDate(date)}
                      onMonthChange={setCalendarMonth}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0}
                      className={cn("p-3 pointer-events-auto w-full")}
                      modifiers={{
                        green: (date) => getDayAvailabilityClass(date) === "green",
                        yellow: (date) => getDayAvailabilityClass(date) === "yellow",
                        orange: (date) => getDayAvailabilityClass(date) === "orange",
                        red: (date) => getDayAvailabilityClass(date) === "red",
                        full: (date) => getDayAvailabilityClass(date) === "full",
                      }}
                      modifiersClassNames={{
                        green: "!bg-green-500/30 !text-green-300 font-bold",
                        yellow: "!bg-yellow-500/30 !text-yellow-300 font-bold",
                        orange: "!bg-orange-500/30 !text-orange-300 font-bold",
                        red: "!bg-red-500/30 !text-red-300 font-bold",
                        full: "!bg-gray-600/30 !text-gray-500 !line-through !opacity-60",
                      }}
                    />
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 justify-center text-xs font-body text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500/50 inline-block" /> Available</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500/50 inline-block" /> Filling up</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500/50 inline-block" /> Almost full</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500/50 inline-block" /> Last spots</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500/50 inline-block" /> Waitlist</span>
                  </div>

                  {selectedDate && (
                    <>
                      {/* Urgency messages */}
                      {getUrgencyMessage() && (
                        <div className="text-center py-2 px-3 rounded-md bg-accent/10 border border-accent/30">
                          <p className="font-body text-sm text-accent font-medium">{getUrgencyMessage()}</p>
                        </div>
                      )}

                      {allSlotsBooked ? (
                        <div
                          className="flex flex-col items-center text-center gap-3"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            borderRadius: "14px",
                            padding: "22px 16px",
                          }}
                        >
                          <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                            <Lock size={24} className="text-muted-foreground" />
                          </div>
                          <h3 className="font-serif text-lg font-semibold text-foreground">This day is fully booked</h3>
                          <p className="font-body text-sm text-muted-foreground leading-relaxed">
                            All slots are taken — but you can join the waiting list and be notified instantly if someone cancels.
                          </p>
                          <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1 text-xs font-body">
                            <Zap size={12} className="text-accent" /> Instant notification if a slot opens
                          </Badge>
                          <Button
                            onClick={() => setWaitingListOpen(true)}
                            className="bg-accent hover:bg-accent/90 text-background font-body text-base px-8 py-3 w-full mt-1"
                          >
                            📋 Join Waiting List
                          </Button>
                          <Button
                            onClick={() => setSelectedDate(undefined)}
                            variant="outline"
                            className="font-body text-sm w-full border-border"
                          >
                            Choose another day
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {TIME_SLOTS.map(tm => {
                            const booked = bookedSlots.includes(tm);
                            return (
                              <button
                                key={tm}
                                disabled={booked}
                                onClick={() => setSelectedTime(tm)}
                                className={cn(
                                  "py-2 rounded text-sm font-body transition-all border",
                                  booked
                                    ? "border-border text-muted-foreground/40 cursor-not-allowed line-through"
                                    : selectedTime === tm
                                      ? "border-accent bg-accent/20 text-foreground"
                                      : "border-border hover:border-accent/50 text-foreground"
                                )}
                              >
                                {tm}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep(2)} className="text-muted-foreground font-body text-sm">{t("booking.back")}</Button>
                    {selectedDate && selectedTime && !allSlotsBooked && (
                      <Button onClick={() => setStep(4)} className="bg-accent hover:bg-accent/90 text-background font-body ml-auto">
                        {t("booking.continue")}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (() => {
                const showEmailField = loggedInEmail ? true : (contactPreference === 'email' || contactPreference === 'all');
                const hideEmailField = !loggedInEmail && (contactPreference === 'sms' || contactPreference === 'call');
                const emailDisabled = loggedInEmail ? true : contactPreference === null;
                const showPhoneField = contactPreference === 'sms' || contactPreference === 'call' || contactPreference === 'all';
                const hidePhoneField = contactPreference === 'email';
                const phoneDisabled = contactPreference === null;
                const needsWarning = contactPreference === null && clientName.length > 0;

                // Trigger shake once
                if (needsWarning && !prefShakeTriggered) {
                  setPrefShakeTriggered(true);
                }

                const isConfirmDisabled = submitting || !clientName.trim() || contactPreference === null ||
                  ((contactPreference === 'email' || contactPreference === 'all') && !clientEmail.trim() && !loggedInEmail) ||
                  ((contactPreference === 'sms' || contactPreference === 'call' || contactPreference === 'all') && !clientPhone.trim());

                return (
                <div style={{ padding: "0 0 14px" }}>
                  {/* Section label */}
                  <div style={{
                    fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 1, textTransform: "uppercase" as const,
                    fontFamily: "Arial", display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
                  }}>
                    <span style={{ width: 14, height: 1, background: "rgba(201,168,76,0.3)", display: "inline-block" }} />
                    Seus dados
                  </div>

                  {/* Contact preference pills */}
                  <div style={{ opacity: 0, animation: "fadeUpForm 0.38s ease forwards", animationDelay: "0.05s", marginBottom: 10 }}>
                    {needsWarning && (
                      <div style={{ fontSize: 11, color: "#ff4444", fontFamily: "Arial", marginBottom: 8, animation: prefShakeTriggered ? "prefShake 0.4s ease" : "none" }}>
                        ⚠️ Escolha como quer receber a confirmação
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", fontFamily: "Arial", marginBottom: 8, lineHeight: 1.4 }}>
                      Qual a sua <span style={{ color: "#C9A84C" }}>melhor forma</span> de receber confirmação?
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                      {([
                        { value: 'sms' as const, label: '📱 SMS' },
                        { value: 'email' as const, label: '✉️ Email' },
                        { value: 'call' as const, label: '📞 Ligação' },
                        { value: 'all' as const, label: '🔔 Todos' },
                      ]).map(pill => {
                        const isActive = contactPreference === pill.value;
                        const isRedState = needsWarning;
                        return (
                          <button
                            key={pill.value}
                            type="button"
                            onClick={() => {
                              setContactPreference(pill.value);
                              if (!clientName.trim()) {
                                const nameInput = document.querySelector<HTMLInputElement>('input[placeholder="Nome *"]');
                                nameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => nameInput?.focus(), 300);
                              }
                            }}
                            style={{
                              flex: 1,
                              background: isActive ? "rgba(201,168,76,0.12)" : isRedState ? "rgba(220,50,50,0.05)" : "rgba(255,255,255,0.04)",
                              border: `1.5px solid ${isActive ? "#C9A84C" : isRedState ? "rgba(220,50,50,0.6)" : "rgba(255,255,255,0.09)"}`,
                              borderRadius: 99,
                              padding: "9px 4px",
                              fontSize: 10,
                              color: isActive ? "#C9A84C" : isRedState ? "rgba(220,50,50,0.8)" : "rgba(255,255,255,0.35)",
                              fontFamily: "Arial",
                              fontWeight: isActive ? 500 : 400,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "all 0.22s",
                              animation: isRedState && !isActive ? "prefPulse 1.5s ease infinite" : "none",
                            }}
                          >
                            {pill.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nome field */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8, opacity: 0, animation: "fadeUpForm 0.42s ease forwards", animationDelay: "0.12s" }}>
                    <span style={{ fontSize: 9, color: "rgba(201,168,76,0.5)", letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "Arial" }}>Nome</span>
                    <div className="border-run-box" style={{ padding: 1.5, borderRadius: 12, background: "rgba(255,255,255,0.07)" }}>
                      <input
                        placeholder="Nome *"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        style={{ background: "#181818", border: "none", borderRadius: 11, padding: "13px 14px", fontSize: 13, color: "#e0e0e0", outline: "none", width: "100%", fontFamily: "Arial" }}
                        onFocus={e => {
                          const box = e.currentTarget.parentElement;
                          if (box) { box.style.background = "linear-gradient(90deg, #A07830, #C9A84C, #f5e49c, #C9A84C, #A07830)"; box.style.backgroundSize = "200% auto"; box.style.animation = "borderRun 1.8s linear infinite"; }
                          const lbl = box?.parentElement?.querySelector("span");
                          if (lbl) lbl.style.color = "#C9A84C";
                        }}
                        onBlur={e => {
                          const box = e.currentTarget.parentElement;
                          if (box) { box.style.background = "rgba(255,255,255,0.07)"; box.style.animation = "none"; }
                          const lbl = box?.parentElement?.querySelector("span");
                          if (lbl) lbl.style.color = "rgba(201,168,76,0.5)";
                        }}
                      />
                    </div>
                  </div>

                  {/* Email + Phone row */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {/* Email */}
                    {!hideEmailField && (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, opacity: 0, animation: "fadeUpForm 0.42s ease forwards", animationDelay: "0.18s" }}>
                        <span style={{ fontSize: 9, color: "rgba(201,168,76,0.5)", letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "Arial", display: "flex", alignItems: "center", gap: 6 }}>
                          Email
                          {loggedInEmail && (
                            <span style={{ fontSize: 8, color: "#4A7C2F", background: "rgba(74,124,47,0.15)", padding: "1px 6px", borderRadius: 8, fontWeight: 500 }}>✓ Conta conectada</span>
                          )}
                        </span>
                        <div className="border-run-box" style={{
                          padding: 1.5, borderRadius: 12,
                          background: loggedInEmail ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.07)",
                          ...(emailDisabled && !loggedInEmail ? { opacity: 0.4 } : {}),
                        }}>
                          <input
                            placeholder={emailDisabled && !loggedInEmail ? "Escolha uma opção acima primeiro" : "Email *"}
                            type="email"
                            value={clientEmail}
                            onChange={e => { if (!loggedInEmail) setClientEmail(e.target.value); }}
                            readOnly={!!loggedInEmail}
                            disabled={emailDisabled && !loggedInEmail}
                            style={{
                              background: loggedInEmail ? "transparent" : "#181818",
                              border: loggedInEmail ? "1px solid rgba(74,124,47,0.3)" : "none",
                              borderRadius: 11, padding: "13px 14px", fontSize: 13,
                              color: loggedInEmail ? "rgba(255,255,255,0.5)" : "#e0e0e0",
                              outline: "none", width: "100%", fontFamily: "Arial",
                              cursor: loggedInEmail || (emailDisabled && !loggedInEmail) ? "not-allowed" : "text",
                            }}
                            onFocus={e => {
                              if (loggedInEmail || emailDisabled) return;
                              const box = e.currentTarget.parentElement;
                              if (box) { box.style.background = "linear-gradient(90deg, #A07830, #C9A84C, #f5e49c, #C9A84C, #A07830)"; box.style.backgroundSize = "200% auto"; box.style.animation = "borderRun 1.8s linear infinite"; }
                              const lbl = box?.parentElement?.querySelector("span");
                              if (lbl) lbl.style.color = "#C9A84C";
                            }}
                            onBlur={e => {
                              if (loggedInEmail || emailDisabled) return;
                              const box = e.currentTarget.parentElement;
                              if (box) { box.style.background = "rgba(255,255,255,0.07)"; box.style.animation = "none"; }
                              const lbl = box?.parentElement?.querySelector("span");
                              if (lbl) lbl.style.color = "rgba(201,168,76,0.5)";
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {/* Phone */}
                    {!hidePhoneField && (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, opacity: 0, animation: "fadeUpForm 0.42s ease forwards", animationDelay: "0.21s", ...(phoneDisabled ? { opacity: 0.4 } : {}) }}>
                        <span style={{ fontSize: 9, color: "rgba(201,168,76,0.5)", letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "Arial" }}>Telefone</span>
                        <div className="border-run-box" style={{ padding: 1.5, borderRadius: 12, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center" }}>
                          <div style={{ flexShrink: 0 }}>
                            <CountryCodeSelector selected={selectedCountry} onSelect={setSelectedCountry} />
                          </div>
                          <input
                            placeholder={selectedCountry.code === "IE" ? "085 123 4567" : t("booking.phone")}
                            value={clientPhone}
                            onChange={e => setClientPhone(e.target.value.replace(/[^0-9]/g, ''))}
                            disabled={phoneDisabled}
                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "13px 10px", fontSize: 13, color: "#e0e0e0", fontFamily: "Arial", cursor: phoneDisabled ? "not-allowed" : "text" }}
                            onFocus={e => {
                              if (phoneDisabled) return;
                              const box = e.currentTarget.parentElement;
                              if (box) { box.style.background = "linear-gradient(90deg, #A07830, #C9A84C, #f5e49c, #C9A84C, #A07830)"; box.style.backgroundSize = "200% auto"; box.style.animation = "borderRun 1.8s linear infinite"; }
                              const lbl = box?.parentElement?.querySelector("span");
                              if (lbl) lbl.style.color = "#C9A84C";
                            }}
                            onBlur={e => {
                              if (phoneDisabled) return;
                              const box = e.currentTarget.parentElement;
                              if (box) { box.style.background = "rgba(255,255,255,0.07)"; box.style.animation = "none"; }
                              const lbl = box?.parentElement?.querySelector("span");
                              if (lbl) lbl.style.color = "rgba(201,168,76,0.5)";
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary card */}
                  <div style={{
                    opacity: 0, animation: "zoomInSum 0.4s cubic-bezier(.22,.68,0,1.15) forwards", animationDelay: "0.2s",
                    background: "#1a1a1a", borderRadius: 14, padding: "13px 14px", marginBottom: 10,
                  }}>
                    <div style={{
                      fontSize: 8, color: "rgba(201,168,76,0.45)", letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: "Arial",
                      marginBottom: 9, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,0.05)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span>Resumo</span>
                      <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(74,124,47,0.2)", border: "1px solid rgba(74,124,47,0.4)", color: "#4A7C2F", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                      {[
                        { label: "Barbeiro", value: selectedBarberName || "" },
                        { label: "Serviço", value: selectedServiceObj?.name || "" },
                        { label: "Data", value: selectedDate ? format(selectedDate, "dd/MM/yyyy") : "" },
                        { label: "Hora", value: selectedTime },
                      ].map((row) => (
                        <div key={row.label} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "Arial", marginBottom: 2 }}>{row.label}</div>
                          <div style={{ fontSize: 12, color: "#e0e0e0", fontWeight: 500 }}>{row.value}</div>
                        </div>
                      ))}
                      <div style={{ gridColumn: "span 2", borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: 4, paddingTop: 8 }}>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "Arial", marginBottom: 2 }}>Total</div>
                        <div style={{
                          background: "linear-gradient(90deg, #C9A84C, #f5e49c, #C9A84C)", backgroundSize: "300% auto",
                          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                          animation: "shimmerGold 2s linear infinite", fontWeight: "bold", fontFamily: "Georgia", fontSize: 15,
                        }}>€{Number(selectedServiceObj?.price || 0).toFixed(0)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handleSubmit}
                    disabled={isConfirmDisabled}
                    style={{
                      opacity: 0, animation: "fadeUpForm 0.42s ease forwards", animationDelay: "0.34s",
                      background: "#C9A84C", border: "none", borderRadius: 14, padding: 15,
                      width: "100%", fontSize: 15, fontWeight: "bold", color: "#111", fontFamily: "Georgia", letterSpacing: 0.3,
                      cursor: isConfirmDisabled ? "not-allowed" : "pointer",
                      ...(isConfirmDisabled ? { filter: "opacity(0.5)" } : {}),
                    }}
                  >
                    {submitting ? t("booking.confirming") : "Confirmar →"}
                  </button>

                  {/* Back button */}
                  <div onClick={() => setStep(3)} style={{ textAlign: "center", padding: "8px 0 2px", fontSize: 12, color: "rgba(255,255,255,0.18)", cursor: "pointer", fontFamily: "Arial" }}>
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
