import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, User, Scissors, X, Check } from "lucide-react";
import emailjs from "@emailjs/browser";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import CountryCodeSelector, { COUNTRIES, formatPhoneForSubmit, type Country } from "@/components/CountryCodeSelector";
import WaitingListForm from "@/components/WaitingListForm";

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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [waitingListOpen, setWaitingListOpen] = useState(false);
  const { t } = useLanguage();

  const allSlotsBooked = selectedDate && bookedSlots.length >= TOTAL_SLOTS;

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
    console.log("[BookingModal] Fetching booked slots for barber:", selectedBarber, "date:", dateStr);
    const { data, error } = await supabase
      .from("appointments")
      .select("time_slot")
      .eq("barber_id", selectedBarber)
      .eq("appointment_date", dateStr)
      .in("status", ["booked", "confirmed"]);
    if (error) {
      console.error("[BookingModal] Error fetching booked slots:", error);
      return;
    }
    const slots = (data || []).map(d => d.time_slot.slice(0, 5));
    console.log("[BookingModal] Booked slots:", slots);
    setBookedSlots(slots);
    // Clear selected time if it's now booked
    if (selectedTime && slots.includes(selectedTime)) {
      console.log("[BookingModal] Selected time is now booked, clearing:", selectedTime);
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
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const notifyWaitingList = async (barberId: string, date: string, cancelledTime: string) => {
    console.log("[WaitingList] Starting notification for barber:", barberId, "date:", date, "time:", cancelledTime);
    
    const { data: waiters, error: fetchError } = await supabase
      .from("waiting_list")
      .select("*")
      .eq("barber_id", barberId)
      .eq("appointment_date", date)
      .in("status", ["pending"]);

    if (fetchError) {
      console.error("[WaitingList] Error fetching waiters:", fetchError);
      return;
    }

    console.log("[WaitingList] Found waiters:", waiters?.length || 0);
    if (!waiters || waiters.length === 0) return;

    const baseUrl = window.location.origin;
    const barberName = barbers.find(b => b.id === barberId)?.name || "";

    for (const waiter of waiters) {
      console.log("[WaitingList] Notifying waiter:", waiter.client_name, waiter.client_email);
      
      const acceptLink = `${baseUrl}/waiting-list/accept?id=${waiter.id}&date=${date}&time=${cancelledTime}&barber_id=${barberId}&name=${encodeURIComponent(waiter.client_name)}&email=${encodeURIComponent(waiter.client_email || "")}&phone=${encodeURIComponent(waiter.client_phone || "")}`;
      const declineLink = `${baseUrl}/waiting-list/decline?id=${waiter.id}`;

      // Update status to notified
      const { error: updateError } = await supabase.from("waiting_list").update({ 
        status: "notified", 
        notified_at: new Date().toISOString() 
      }).eq("id", waiter.id);
      
      if (updateError) {
        console.error("[WaitingList] Error updating status:", updateError);
      } else {
        console.log("[WaitingList] Status updated to notified for:", waiter.id);
      }

      // Send email via EmailJS
      console.log("[WaitingList] Sending EmailJS notification...");
      try {
        const emailResult = await emailjs.send(
          "service_jq26o2f",
          "template_9wigrr6",
          {
            to_name: waiter.client_name,
            to_email: waiter.client_email,
            date: date,
            time: cancelledTime,
            accept_link: acceptLink,
            decline_link: declineLink,
          }
        );
        console.log("[WaitingList] EmailJS sent successfully:", emailResult);
      } catch (emailErr) {
        console.error("[WaitingList] EmailJS error:", emailErr);
      }

      // Send SMS via Edge Function
      if (waiter.client_phone) {
        console.log("[WaitingList] Sending SMS to:", waiter.client_phone);
        const smsMsg = `House of Fades: A slot opened on ${date} at ${cancelledTime}! Accept: ${acceptLink} | Decline: ${declineLink}`;
        try {
          const smsResult = await supabase.functions.invoke("send-sms", {
            body: {
              action: "waiting-list-notify",
              phone: waiter.client_phone,
              message: smsMsg,
            },
          });
          console.log("[WaitingList] SMS result:", smsResult);
        } catch (smsErr) {
          console.error("[WaitingList] SMS error:", smsErr);
        }
      }
    }

    // Set 15 minute timeout - remove unresponsive waiters
    setTimeout(async () => {
      console.log("[WaitingList] 15min timeout - checking expired waiters");
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: expired } = await supabase
        .from("waiting_list")
        .select("*")
        .eq("barber_id", barberId)
        .eq("appointment_date", date)
        .eq("status", "notified")
        .lt("notified_at", fifteenMinAgo);

      if (expired) {
        console.log("[WaitingList] Expired waiters to cancel:", expired.length);
        for (const entry of expired) {
          await supabase.from("waiting_list").update({ status: "cancelled" }).eq("id", entry.id);
        }
      }
    }, 15 * 60 * 1000);
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
    }
  };

  const selectedBarberName = barbers.find(b => b.id === selectedBarber)?.name;
  const selectedServiceObj = services.find(s => s.id === selectedService);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-card border-accent/20 text-foreground max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl gold-title-gradient">
              {success ? t("booking.booked") : t("booking.title")}
            </DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
                <Check size={32} className="text-[#4A7C2F]" />
              </div>
              <p className="font-body text-foreground">{t("booking.successMsg")}</p>
              <div className="text-sm text-muted-foreground font-body space-y-1">
                <p><strong>{t("booking.barber")}</strong> {selectedBarberName}</p>
                <p><strong>{t("booking.service")}</strong> {selectedServiceObj?.name}</p>
                <p><strong>{t("booking.date")}</strong> {selectedDate && format(selectedDate, "dd/MM/yyyy")}</p>
                <p><strong>{t("booking.time")}</strong> {selectedTime}</p>
              </div>
              <Button onClick={() => handleClose(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-body mt-4">
                {t("booking.close")}
              </Button>
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
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-body border-border", !selectedDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : t("booking.selectDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }}
                        onMonthChange={setCalendarMonth}
                        disabled={(date) => date < new Date() || date.getDay() === 0}
                        className={cn("p-3 pointer-events-auto")}
                        modifiers={{
                          green: (date) => getDayAvailabilityClass(date) === "green",
                          yellow: (date) => getDayAvailabilityClass(date) === "yellow",
                          orange: (date) => getDayAvailabilityClass(date) === "orange",
                          red: (date) => getDayAvailabilityClass(date) === "red",
                          full: (date) => getDayAvailabilityClass(date) === "full",
                        }}
                        modifiersClassNames={{
                          green: "!bg-green-500/20 !text-green-400",
                          yellow: "!bg-yellow-500/20 !text-yellow-400",
                          orange: "!bg-orange-500/20 !text-orange-400",
                          red: "!bg-red-500/20 !text-red-400",
                          full: "!bg-gray-500/20 !text-gray-500 !line-through !opacity-50",
                        }}
                      />
                    </PopoverContent>
                  </Popover>

                  {selectedDate && (
                    <>
                      {allSlotsBooked ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            {TIME_SLOTS.map(tm => (
                              <button
                                key={tm}
                                disabled
                                className="py-2 rounded text-sm font-body border border-border text-muted-foreground/40 cursor-not-allowed line-through bg-muted/20"
                              >
                                {tm}
                              </button>
                            ))}
                          </div>
                          <div className="flex justify-center pt-2">
                            <Button
                              onClick={() => setWaitingListOpen(true)}
                              className="bg-accent hover:bg-accent/90 text-background font-body text-lg px-8 py-4"
                            >
                              📋 Join Waiting List
                            </Button>
                          </div>
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
