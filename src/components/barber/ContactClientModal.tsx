import { useState, useMemo } from "react";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MessageSquare, Mail, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";

let emailjsInited = false;
const ensureEmailJSInit = () => {
  if (!emailjsInited) {
    emailjs.init("TBNWeHLfrq6OuvZhQ");
    emailjsInited = true;
  }
};

export type ContactTarget = {
  id: string;
  appointment_date: string;
  time_slot: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  contact_preference: string | null;
  services: { name: string } | null;
  barbers: { name: string } | null;
};

type Tab = "sms" | "email" | "call";

const GOLD = "#c9a84c";

const ContactClientModal = ({
  target,
  onClose,
}: {
  target: ContactTarget | null;
  onClose: () => void;
}) => {
  const open = !!target;

  const availableTabs = useMemo<Tab[]>(() => {
    if (!target) return [];
    const pref = (target.contact_preference || "both").toLowerCase();
    if (pref === "sms") return ["sms"];
    if (pref === "email") return ["email"];
    if (pref === "call" || pref === "ligacao" || pref === "ligação") return ["call"];
    // "both", "todos", or anything else → all available
    return ["sms", "email", "call"];
  }, [target]);

  const [tab, setTab] = useState<Tab>("sms");
  const [smsMessage, setSmsMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("House of Fades — Sobre a sua marcação");
  const [emailMessage, setEmailMessage] = useState("");
  const [callTask, setCallTask] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset state + initial tab when target changes
  useMemo(() => {
    if (target) {
      setTab(availableTabs[0] || "sms");
      setSmsMessage("");
      setEmailMessage("");
      setEmailSubject("House of Fades — Sobre a sua marcação");
      setCallTask("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  if (!target) return null;

  const dateStr = format(parseISO(target.appointment_date), "dd/MM");
  const timeStr = target.time_slot.slice(0, 5);
  const serviceName = target.services?.name || "";
  const barberName = target.barbers?.name || "";

  const logContact = async (
    method: "sms" | "email" | "call",
    message: string,
    status: "sent" | "failed",
    subject?: string,
    errorMessage?: string
  ) => {
    const { data: u } = await supabase.auth.getUser();
    await (supabase.from("contact_logs" as any) as any).insert({
      appointment_id: target.id,
      client_name: target.client_name,
      client_contact: method === "email" ? target.client_email : target.client_phone,
      method,
      subject: subject || null,
      message_content: message,
      status,
      error_message: errorMessage || null,
      created_by: u?.user?.id || null,
    });
  };

  const handleSendSMS = async () => {
    if (!target.client_phone) {
      toast.error("Cliente não tem telefone");
      return;
    }
    if (!smsMessage.trim()) {
      toast.error("Escreva uma mensagem");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { action: "custom", phone: target.client_phone, message: smsMessage.trim() },
      });
      if (error || !data?.success) throw new Error(error?.message || "SMS failed");
      await logContact("sms", smsMessage.trim(), "sent");
      toast.success(`SMS enviado para ${target.client_name} ✓`);
      onClose();
    } catch (e: any) {
      await logContact("sms", smsMessage.trim(), "failed", undefined, String(e?.message || e));
      toast.error("Falha ao enviar SMS");
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmail = async () => {
    if (!target.client_email) {
      toast.error("Cliente não tem email");
      return;
    }
    if (!emailMessage.trim()) {
      toast.error("Escreva uma mensagem");
      return;
    }
    setBusy(true);
    try {
      ensureEmailJSInit();
      await emailjs.send("service_jq26o2f", "template_7i3p8r9", {
        to_name: target.client_name,
        to_email: target.client_email,
        subject: emailSubject,
        message: emailMessage.trim(),
        barber_name: barberName,
        service_name: serviceName,
        appointment_date: dateStr,
        appointment_time: timeStr,
      });
      await logContact("email", emailMessage.trim(), "sent", emailSubject);
      toast.success(`Email enviado para ${target.client_name} ✓`);
      onClose();
    } catch (e: any) {
      await logContact("email", emailMessage.trim(), "failed", emailSubject, String(e?.message || e));
      toast.error("Falha ao enviar email");
    } finally {
      setBusy(false);
    }
  };

  const handleCall = async () => {
    if (!target.client_phone) {
      toast.error("Cliente não tem telefone");
      return;
    }
    if (!callTask.trim()) {
      toast.error("Descreva o motivo da chamada");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("contact-call", {
        body: {
          clientName: target.client_name,
          clientPhone: target.client_phone,
          task: callTask.trim(),
        },
      });
      if (error || !data?.success) throw new Error(error?.message || "Call failed");
      await logContact("call", callTask.trim(), "sent");
      toast.success(`Chamada iniciada ✓`);
      onClose();
    } catch (e: any) {
      await logContact("call", callTask.trim(), "failed", undefined, String(e?.message || e));
      toast.error("Falha ao iniciar chamada");
    } finally {
      setBusy(false);
    }
  };

  const tabMeta: Record<Tab, { label: string; icon: any }> = {
    sms: { label: "SMS", icon: MessageSquare },
    email: { label: "Email", icon: Mail },
    call: { label: "IA", icon: Phone },
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        className="border-0 p-0 max-w-md text-white"
        style={{ background: "#111", borderRadius: 14 }}
      >
        <DialogHeader className="p-5 pb-3 border-b" style={{ borderColor: "#2a2a2a" }}>
          <DialogTitle className="font-serif text-xl" style={{ color: GOLD }}>
            Contactar — {target.client_name}
          </DialogTitle>
          <p className="font-body text-sm text-white/70 mt-1">{serviceName}</p>
          <p className="font-body text-xs text-white/50">
            {dateStr} às {timeStr} · {barberName}
          </p>
        </DialogHeader>

        <div className="px-5 pt-4">
          <div className="flex gap-2 border-b" style={{ borderColor: "#2a2a2a" }}>
            {availableTabs.map((tk) => {
              const Icon = tabMeta[tk].icon;
              const active = tab === tk;
              return (
                <button
                  key={tk}
                  onClick={() => setTab(tk)}
                  className="flex items-center gap-1.5 px-3 py-2 font-body text-xs uppercase tracking-wider transition-colors"
                  style={{
                    color: active ? GOLD : "rgba(255,255,255,0.5)",
                    borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tabMeta[tk].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 pt-4 space-y-3">
          {tab === "sms" && (
            <>
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value.slice(0, 160))}
                placeholder="Escreva a sua mensagem..."
                rows={5}
                className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{
                  background: "#1c1c1c",
                  borderColor: "#2a2a2a",
                  borderRadius: 8,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              />
              <div className="flex justify-between items-center">
                <span className="font-body text-xs text-white/40">{smsMessage.length}/160</span>
                <button
                  onClick={handleSendSMS}
                  disabled={busy || !smsMessage.trim()}
                  className="font-body text-xs font-medium uppercase tracking-wider px-5 py-2.5 transition-opacity disabled:opacity-40"
                  style={{ background: GOLD, color: "#050505", borderRadius: 6 }}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Enviar SMS →"}
                </button>
              </div>
            </>
          )}

          {tab === "email" && (
            <>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Assunto"
                className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ background: "#1c1c1c", borderColor: "#2a2a2a", borderRadius: 8 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              />
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Escreva a sua mensagem..."
                rows={5}
                className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ background: "#1c1c1c", borderColor: "#2a2a2a", borderRadius: 8 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSendEmail}
                  disabled={busy || !emailMessage.trim()}
                  className="font-body text-xs font-medium uppercase tracking-wider px-5 py-2.5 transition-opacity disabled:opacity-40"
                  style={{ background: GOLD, color: "#050505", borderRadius: 6 }}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Enviar Email →"}
                </button>
              </div>
            </>
          )}

          {tab === "call" && (
            <>
              <label className="font-body text-xs uppercase tracking-wider text-white/60">
                Descreva o motivo da chamada
              </label>
              <Textarea
                value={callTask}
                onChange={(e) => setCallTask(e.target.value)}
                placeholder="Ex: O barbeiro Mario ficou doente e precisamos remarcar a sua consulta de amanhã às 14:00"
                rows={5}
                className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ background: "#1c1c1c", borderColor: "#2a2a2a", borderRadius: 8 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              />
              <div className="flex justify-end items-center gap-3">
                {busy && (
                  <span className="font-body text-xs text-white/60 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    A ligar para {target.client_name}...
                  </span>
                )}
                <button
                  onClick={handleCall}
                  disabled={busy || !callTask.trim()}
                  className="font-body text-xs font-medium uppercase tracking-wider px-5 py-2.5 transition-opacity disabled:opacity-40"
                  style={{ background: GOLD, color: "#050505", borderRadius: 6 }}
                >
                  Iniciar Chamada com IA →
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactClientModal;