import { useState, useEffect } from "react";
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
import CountryCodeSelector, { COUNTRIES, formatPhoneForSubmit, type Country } from "@/components/CountryCodeSelector";

type Barber = { id: string; name: string };
type Service = { id: string; name: string; price: number; duration_minutes: number };

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedBarber?: string; // barber name to preselect
}

const BookingModal = ({ open, onOpenChange, preselectedBarber }: BookingModalProps) => {
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Ireland default
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Load barbers & services
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

  // Load booked slots when barber+date selected
  useEffect(() => {
    if (!selectedBarber || !selectedDate) return;
    supabase
      .from("appointments")
      .select("time_slot")
      .eq("barber_id", selectedBarber)
      .eq("appointment_date", format(selectedDate, "yyyy-MM-dd"))
      .in("status", ["booked", "confirmed"])
      .then(({ data }) => {
        if (data) setBookedSlots(data.map(d => d.time_slot.slice(0, 5)));
      });
  }, [selectedBarber, selectedDate]);

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

  const handleSubmit = async () => {
    if (!clientName.trim()) { toast.error("Insira seu nome"); return; }
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
      toast.error("Erro ao agendar. Tente novamente.");
      console.error(error);
    } else {
      setSuccess(true);
      // Send confirmation SMS (fire and forget)
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
    }
  };

  const selectedBarberName = barbers.find(b => b.id === selectedBarber)?.name;
  const selectedServiceObj = services.find(s => s.id === selectedService);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-accent/20 text-foreground max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl gold-title-gradient">
            {success ? "Agendado!" : "Agendar Horário"}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={32} className="text-[#4A7C2F]" />
            </div>
            <p className="font-body text-foreground">Seu horário foi agendado com sucesso!</p>
            <div className="text-sm text-muted-foreground font-body space-y-1">
              <p><strong>Barbeiro:</strong> {selectedBarberName}</p>
              <p><strong>Serviço:</strong> {selectedServiceObj?.name}</p>
              <p><strong>Data:</strong> {selectedDate && format(selectedDate, "dd/MM/yyyy")}</p>
              <p><strong>Horário:</strong> {selectedTime}</p>
            </div>
            <Button onClick={() => handleClose(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-body mt-4">
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", step >= s ? "bg-accent" : "bg-muted/30")} />
              ))}
            </div>

            {/* Step 1: Choose Barber */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><User size={16} /> Escolha seu barbeiro</p>
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

            {/* Step 2: Choose Service */}
            {step === 2 && (
              <div className="space-y-3">
                <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><Scissors size={16} /> Escolha o serviço</p>
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
                      <span className="block text-xs text-muted-foreground">{s.duration_minutes} min</span>
                    </div>
                    <span className="text-accent font-serif font-bold">€{Number(s.price).toFixed(0)}</span>
                  </button>
                ))}
                <Button variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground font-body text-sm">← Voltar</Button>
              </div>
            )}

            {/* Step 3: Choose Date & Time */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><CalendarIcon size={16} /> Escolha data e horário</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-body border-border", !selectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date() || date.getDay() === 0}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {selectedDate && (
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map(t => {
                      const booked = bookedSlots.includes(t);
                      return (
                        <button
                          key={t}
                          disabled={booked}
                          onClick={() => setSelectedTime(t)}
                          className={cn(
                            "py-2 rounded text-sm font-body transition-all border",
                            booked
                              ? "border-border text-muted-foreground/40 cursor-not-allowed line-through"
                              : selectedTime === t
                                ? "border-accent bg-accent/20 text-foreground"
                                : "border-border hover:border-accent/50 text-foreground"
                          )}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(2)} className="text-muted-foreground font-body text-sm">← Voltar</Button>
                  {selectedDate && selectedTime && (
                    <Button onClick={() => setStep(4)} className="bg-accent hover:bg-accent/90 text-background font-body ml-auto">
                      Continuar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Client Info */}
            {step === 4 && (
              <div className="space-y-4">
                <p className="font-body text-sm text-muted-foreground">Seus dados</p>
                <div className="space-y-3">
                  <Input
                    placeholder="Nome *"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="bg-background border-border text-foreground font-body"
                  />
                  <div className="flex">
                    <CountryCodeSelector selected={selectedCountry} onSelect={setSelectedCountry} />
                    <Input
                      placeholder={selectedCountry.code === "IE" ? "085 123 4567" : "Número"}
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      className="bg-background border-border text-foreground font-body rounded-l-none"
                    />
                  </div>
                  <Input
                    placeholder="Email"
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    className="bg-background border-border text-foreground font-body"
                  />
                </div>

                {/* Summary */}
                <div className="bg-background/50 rounded p-3 text-sm font-body space-y-1 border border-border">
                  <p><span className="text-muted-foreground">Barbeiro:</span> {selectedBarberName}</p>
                  <p><span className="text-muted-foreground">Serviço:</span> {selectedServiceObj?.name} — <span className="text-accent">€{Number(selectedServiceObj?.price || 0).toFixed(0)}</span></p>
                  <p><span className="text-muted-foreground">Data:</span> {selectedDate && format(selectedDate, "dd/MM/yyyy")} às {selectedTime}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(3)} className="text-muted-foreground font-body text-sm">← Voltar</Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !clientName.trim()}
                    className="bg-[#4A7C2F] hover:bg-[#4A7C2F]/90 text-white font-body ml-auto"
                  >
                    {submitting ? "Agendando..." : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingModal;
