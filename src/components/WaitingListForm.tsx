import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ClipboardList, Check } from "lucide-react";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import CountryCodeSelector, { COUNTRIES, formatPhoneForSubmit, type Country } from "@/components/CountryCodeSelector";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

interface WaitingListFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  barberId: string;
  barberName: string;
}

const WaitingListForm = ({ open, onOpenChange, date, barberId, barberName }: WaitingListFormProps) => {
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { t } = useLanguage();

  const dateStr = format(date, "yyyy-MM-dd");

  useEffect(() => {
    if (!open) return;
    supabase
      .from("waiting_list")
      .select("time_slot")
      .eq("barber_id", barberId)
      .eq("appointment_date", dateStr)
      .in("status", ["pending", "notified"])
      .then(({ data }) => {
        if (data) setTakenSlots(data.map(d => (d.time_slot as string).slice(0, 5)));
      });
  }, [open, barberId, dateStr]);

  const reset = () => {
    setSelectedTime("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setSuccess(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) { toast.error(t("booking.enterName")); return; }
    if (!clientEmail.trim()) { toast.error(t("booking.enterEmail")); return; }
    if (!selectedTime) { toast.error("Please select a time slot"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("waiting_list").insert({
      appointment_date: dateStr,
      time_slot: selectedTime,
      barber_id: barberId,
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Error joining waiting list. Please try again.");
      console.error(error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="bg-card border-accent/20 text-foreground max-w-md mx-auto">
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={32} className="text-[#4A7C2F]" />
            </div>
            <p className="font-body text-foreground font-medium">
              You're on the waiting list for {format(date, "dd/MM/yyyy")} at {selectedTime}.
            </p>
            <p className="font-body text-muted-foreground text-sm">
              We'll email and text you the moment a slot opens!
            </p>
            <Button onClick={() => handleClose(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-body mt-4">
              {t("booking.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="bg-card border-accent/20 text-foreground max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl gold-title-gradient flex items-center gap-2">
            <ClipboardList size={24} /> Join Waiting List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            All slots for {barberName} on {format(date, "dd/MM/yyyy")} are booked. Join the waiting list and we'll notify you when a slot opens!
          </p>

          <div>
            <p className="font-body text-sm text-muted-foreground mb-2">Choose desired time slot:</p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map(tm => {
                const taken = takenSlots.includes(tm);
                return (
                  <button
                    key={tm}
                    disabled={taken}
                    onClick={() => setSelectedTime(tm)}
                    className={cn(
                      "py-2 rounded text-sm font-body transition-all border",
                      taken
                        ? "border-border text-muted-foreground/40 cursor-not-allowed line-through bg-muted/20"
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
          </div>

          <div className="space-y-3">
            <Input
              placeholder={t("booking.name")}
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              className="bg-background border-border text-foreground font-body"
            />
            <Input
              placeholder={t("booking.email")}
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
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
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !clientName.trim() || !clientEmail.trim() || !selectedTime}
            className="w-full bg-accent hover:bg-accent/90 text-background font-body"
          >
            {submitting ? "Joining..." : "📋 Join Waiting List"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WaitingListForm;
