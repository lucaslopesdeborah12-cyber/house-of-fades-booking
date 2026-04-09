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
  const [reminderSMS, setReminderSMS] = useState(true);
  const [reminderEmail, setReminderEmail] = useState(true);
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
    setReminderSMS(true);
    setReminderEmail(true);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const getContactPreference = () => {
    if (reminderSMS && reminderEmail) return "both";
    if (reminderSMS) return "sms";
    if (reminderEmail) return "email";
    return "none";
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) { toast.error(t("booking.enterName")); return; }
    if (!clientEmail.trim()) { toast.error(t("booking.enterEmail")); return; }
    setSubmitting(true);
    const { error } = await supabase.from("appointments").insert({
      barber_id: selectedBarber,
      service_id: selectedService,
      appointment_date: format(selectedDate!, "yyyy-MM-dd"),
      time_slot: selectedTime,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : null,
      client_email: clientEmail.trim() || null,
      contact_preference: getContactPreference(),
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
      if (clientEmail.trim()) {
        emailjs.send(
          "service_jq26o2f",
          "template_7i3p8r9",
          {
            to_name: clientName.trim(),
            to_email: clientEmail.trim(),
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
                <Button
                  onClick={handleDownloadCalendar}
                  className="bg-accent hover:bg-accent/90 text-background font-body w-full"
                >
                  <CalendarDownloadIcon size={16} className="mr-2" /> Add to Calendar 📅
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

              {step === 1 && (
                <div className="space-y-3">
                  <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><User size={16} /> {t("booking.chooseBarber")}</p>
                  {barbers.map(b => (
                    <button
                      key={b.id}
                      onClick={() => { setSelectedBarber(b.id); setStep(2); }}
                      className={cn(
                        "w-full p-4 rounded border text-left font-body transition-all",
                        selectedBarber === b.id
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border hover:border-accent/50 text-foreground"
                      )}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><Scissors size={16} /> {t("booking.chooseService")}</p>
                  {services.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedService(s.id); setStep(3); }}
                      className={cn(
                        "w-full p-4 rounded border text-left font-body transition-all flex justify-between items-center",
                        selectedService === s.id
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      )}
                    >
                      <div>
                        <span className="text-foreground font-medium">{s.name}</span>
                        <span className="block text-xs text-muted-foreground">{s.duration_minutes} {t("services.min")}</span>
                      </div>
                      <span className="text-accent font-serif font-bold">€{Number(s.price).toFixed(0)}</span>
                    </button>
                  ))}
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

              {step === 4 && (
                <div className="space-y-4">
                  <p className="font-body text-sm text-muted-foreground">{t("booking.yourDetails")}</p>
                  <div className="space-y-3">
                    <Input
                      placeholder={t("booking.name")}
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="bg-background border-border text-foreground font-body"
                    />
                    <div className="flex">
                      <CountryCodeSelector selected={selectedCountry} onSelect={setSelectedCountry} />
                      <Input
                        placeholder={selectedCountry.code === "IE" ? "085 123 4567" : t("booking.phone")}
                        value={clientPhone}
                        onChange={e => setClientPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        className="bg-background border-border text-foreground font-body rounded-l-none"
                      />
                    </div>
                    <Input
                      placeholder={t("booking.email")}
                      type="email"
                      value={clientEmail}
                      onChange={e => setClientEmail(e.target.value)}
                      className="bg-background border-border text-foreground font-body"
                    />
                  </div>

                  {/* Contact preference */}
                  <div className="space-y-2">
                    <p className="font-body text-sm text-muted-foreground font-medium">How do you want to be reminded?</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer font-body text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={reminderSMS}
                          onChange={e => setReminderSMS(e.target.checked)}
                          className="rounded border-border accent-accent w-4 h-4"
                        />
                        📱 SMS
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-body text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={reminderEmail}
                          onChange={e => setReminderEmail(e.target.checked)}
                          className="rounded border-border accent-accent w-4 h-4"
                        />
                        📧 Email
                      </label>
                    </div>
                  </div>

                  <div className="bg-background/50 rounded p-3 text-sm font-body space-y-1 border border-border">
                    <p><span className="text-muted-foreground">{t("booking.barber")}</span> {selectedBarberName}</p>
                    <p><span className="text-muted-foreground">{t("booking.service")}</span> {selectedServiceObj?.name} — <span className="text-accent">€{Number(selectedServiceObj?.price || 0).toFixed(0)}</span></p>
                    <p><span className="text-muted-foreground">{t("booking.date")}</span> {selectedDate && format(selectedDate, "dd/MM/yyyy")} {t("booking.at")} {selectedTime}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep(3)} className="text-muted-foreground font-body text-sm">{t("booking.back")}</Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || !clientName.trim() || !clientEmail.trim()}
                      className="bg-[#4A7C2F] hover:bg-[#4A7C2F]/90 text-white font-body ml-auto"
                    >
                      {submitting ? t("booking.confirming") : t("booking.confirm")}
                    </Button>
                  </div>
                </div>
              )}
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
