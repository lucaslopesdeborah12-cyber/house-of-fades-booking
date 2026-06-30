import { useState } from "react";
import { format } from "date-fns";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import CountryCodeSelector, { COUNTRIES, formatPhoneForSubmit, type Country } from "@/components/CountryCodeSelector";

interface WaitingListFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  barberId: string;
  barberName: string;
}

const WaitingListForm = ({ open, onOpenChange, date, barberId, barberName }: WaitingListFormProps) => {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { t } = useLanguage();

  const dateStr = format(date, "yyyy-MM-dd");
  const dateDisplay = format(date, "dd/MM/yyyy");

  const reset = () => {
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
    if (!clientName.trim()) { toast.error(t("waiting.errorName")); return; }
    if (!clientEmail.trim()) { toast.error(t("waiting.errorEmail")); return; }

    setSubmitting(true);
    const { error } = await supabase.from("waiting_list").insert({
      appointment_date: dateStr,
      time_slot: "09:00",
      barber_id: barberId,
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : null,
    });
    setSubmitting(false);

    if (error) {
      toast.error(t("waiting.errorSubmit"));
      console.error(error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="bg-[#050505] border-[#c9a84c]/15 text-foreground max-w-md mx-auto" style={{ borderRadius: 2 }}>
          <div className="text-center py-10 space-y-5">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
                <Check size={200} strokeWidth={0.5} className="text-[#c9a84c]" />
              </div>
              <h2 className="font-serif text-2xl italic text-[#c9a84c] relative z-10">
                {t("waiting.successTitle")}
              </h2>
            </div>
            <p className="font-cormorant text-base italic text-foreground/40">
              {t("waiting.successMsg")} {dateDisplay}.
            </p>
            <button
              onClick={() => handleClose(false)}
              className="font-sans text-[10px] font-light uppercase tracking-[0.2em] text-foreground/25 hover:text-foreground/40 transition-colors mt-4"
            >
              {t("waiting.close")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="bg-[#050505] border-[#c9a84c]/15 text-foreground max-w-md mx-auto" style={{ borderRadius: 2 }}>
        <div className="space-y-6 py-2">
          <div>
            <h2 className="font-serif text-2xl italic text-[#c9a84c] mb-1">{t("waiting.title")}</h2>
            <p className="font-sans text-[10px] font-light uppercase tracking-[0.15em] text-foreground/25 mb-3">
              {dateDisplay} · {barberName}
            </p>
            <p className="font-cormorant text-sm italic text-foreground/35 leading-relaxed">
              {t("waiting.subtitle")}
            </p>
          </div>

          {/* Nome */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 9, color: "rgba(201,168,76,0.4)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Inter', sans-serif", fontWeight: 200 }}>{t("waiting.nameLabel")}</span>
            <input
              placeholder={t("waiting.namePlaceholder")}
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              style={{ background: "transparent", borderBottom: "0.5px solid rgba(201,168,76,0.15)", borderTop: "none", borderLeft: "none", borderRight: "none", borderRadius: 0, padding: "12px 0", fontSize: "16px", color: "#e0e0e0", outline: "none", width: "100%", fontFamily: "'Inter', sans-serif", fontWeight: 300, transition: "border-color 0.2s" }}
              onFocus={e => { e.currentTarget.style.borderBottomColor = "#c9a84c"; }}
              onBlur={e => { e.currentTarget.style.borderBottomColor = "rgba(201,168,76,0.15)"; }}
            />
          </div>

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 9, color: "rgba(201,168,76,0.4)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Inter', sans-serif", fontWeight: 200 }}>{t("waiting.emailLabel")}</span>
            <input
              placeholder="Email *"
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              style={{ background: "transparent", borderBottom: "0.5px solid #c9a84c", borderTop: "none", borderLeft: "none", borderRight: "none", borderRadius: 0, padding: "12px 0", fontSize: "16px", color: "#c9a84c", outline: "none", width: "100%", fontFamily: "'Inter', sans-serif", fontWeight: 300, transition: "border-color 0.2s" }}
            />
          </div>

          {/* Telefone */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 9, color: "rgba(201,168,76,0.4)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Inter', sans-serif", fontWeight: 200 }}>{t("waiting.phoneLabel")}</span>
            <div style={{ display: "flex", borderBottom: "0.5px solid rgba(201,168,76,0.15)", transition: "border-color 0.2s" }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderBottomColor = "#c9a84c"; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderBottomColor = "rgba(201,168,76,0.15)"; }}
            >
              <div style={{ flexShrink: 0 }}>
                <CountryCodeSelector selected={selectedCountry} onSelect={setSelectedCountry} />
              </div>
              <input
                placeholder={selectedCountry.code === "IE" ? "085 123 4567" : t("booking.phone")}
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "12px 10px", fontSize: "16px", color: "#e0e0e0", fontFamily: "'Inter', sans-serif", fontWeight: 300 }}
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !clientName.trim() || !clientEmail.trim()}
            style={{
              background: "#c9a84c", border: "none", borderRadius: 0, padding: 16,
              width: "100%", fontSize: 11, fontWeight: 500, color: "#050505", fontFamily: "'Inter', sans-serif", letterSpacing: "3px", textTransform: "uppercase",
              cursor: (submitting || !clientName.trim() || !clientEmail.trim()) ? "not-allowed" : "pointer",
              ...((submitting || !clientName.trim() || !clientEmail.trim()) ? { filter: "opacity(0.4)" } : {}),
            }}
          >
            {submitting ? t("waiting.submitting") : t("waiting.submit")}
          </button>

          {/* Cancel */}
          <button
            onClick={() => handleClose(false)}
            className="w-full font-sans text-[10px] font-light uppercase tracking-[0.15em] text-foreground/20 hover:text-foreground/40 transition-colors"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 0" }}
          >
            {t("waiting.cancel")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WaitingListForm;
