import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MessageSquare, Mail, Phone, X, Zap, Check } from "lucide-react";
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

type MsgTab = "sms" | "email";

const GOLD = "#c9a84c";

const ContactClientModal = ({
  target,
  onClose,
}: {
  target: ContactTarget | null;
  onClose: () => void;
}) => {
  const open = !!target;

  const { availableMsgTabs, showCall } = useMemo(() => {
    if (!target) return { availableMsgTabs: [] as MsgTab[], showCall: false };
    const pref = (target.contact_preference || "both").toLowerCase();
    if (pref === "sms") return { availableMsgTabs: ["sms"] as MsgTab[], showCall: false };
    if (pref === "email") return { availableMsgTabs: ["email"] as MsgTab[], showCall: false };
    if (pref === "call" || pref === "ligacao" || pref === "ligação")
      return { availableMsgTabs: [] as MsgTab[], showCall: true };
    return { availableMsgTabs: ["sms", "email"] as MsgTab[], showCall: true };
  }, [target]);

  const [msgTab, setMsgTab] = useState<MsgTab>("sms");
  const [smsMessage, setSmsMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("House of Fades — Sobre a sua marcação");
  const [emailMessage, setEmailMessage] = useState("");
  const [callTask, setCallTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [callState, setCallState] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Reset state + initial tab when target changes
  useEffect(() => {
    if (target) {
      setMsgTab(availableMsgTabs[0] || "sms");
      setSmsMessage("");
      setEmailMessage("");
      setEmailSubject("House of Fades — Sobre a sua marcação");
      setCallTask("");
      setCallState("idle");
    }
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
      // EmailJS Service ID: service_ri5wxqg
      await emailjs.send("service_ri5wxqg", "template_7i3p8r9", {
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
    setCallState("loading");
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
      setCallState("success");
      toast.success(`Chamada iniciada ✓`);
      setTimeout(() => setCallState("idle"), 4000);
    } catch (e: any) {
      await logContact("call", callTask.trim(), "failed", undefined, String(e?.message || e));
      setCallState("error");
      setTimeout(() => setCallState("idle"), 4000);
    }
  };

  const tabMeta: Record<MsgTab, { label: string; icon: any }> = {
    sms: { label: "SMS", icon: MessageSquare },
    email: { label: "Email", icon: Mail },
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && callState !== "loading" && onClose()}>
      <DialogContent
        className="border p-0 max-w-md text-white max-h-[90vh] overflow-y-auto [&>button]:hidden"
        style={{ background: "#111", borderRadius: 16, borderColor: "#2a2a2a" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="p-7"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <DialogTitle className="font-body text-base font-medium text-white">
                Contactar — {target.client_name}
              </DialogTitle>
              <p className="font-body text-[13px] text-[#666] mt-1">
                {serviceName} · {dateStr} às {timeStr} · {barberName}
              </p>
            </div>
            <button
              onClick={() => !busy && callState !== "loading" && onClose()}
              className="text-[#555] hover:text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* SECTION 1 — MENSAGEM DIRETA */}
            {availableMsgTabs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
              >
                <p
                  className="font-body uppercase mb-2.5"
                  style={{ color: GOLD, fontSize: 10, letterSpacing: "0.12em" }}
                >
                  Mensagem Direta
                </p>
                <div
                  className="p-4"
                  style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12 }}
                >
                  {/* Pill tabs */}
                  <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "#2a2a2a" }}>
                    {availableMsgTabs.map((tk) => {
                      const Icon = tabMeta[tk].icon;
                      const active = msgTab === tk;
                      return (
                        <button
                          key={tk}
                          onClick={() => setMsgTab(tk)}
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

                  {msgTab === "sms" && (
                    <div className="space-y-3">
                      <Textarea
                        value={smsMessage}
                        onChange={(e) => setSmsMessage(e.target.value.slice(0, 160))}
                        placeholder="Escreva a sua mensagem..."
                        rows={5}
                        className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
                        style={{ background: "#111", borderColor: "#2a2a2a", borderRadius: 8 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                      <div className="flex justify-end">
                        <span className="font-body text-xs text-white/40">{smsMessage.length}/160</span>
                      </div>
                      <button
                        onClick={handleSendSMS}
                        disabled={busy || !smsMessage.trim()}
                        className="w-full font-body text-xs font-medium uppercase tracking-wider py-3 transition-opacity disabled:opacity-40"
                        style={{ background: GOLD, color: "#050505", borderRadius: 8 }}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Enviar SMS →"}
                      </button>
                    </div>
                  )}

                  {msgTab === "email" && (
                    <div className="space-y-3">
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Assunto"
                        className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ background: "#111", borderColor: "#2a2a2a", borderRadius: 8 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                      <Textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        placeholder="Escreva a sua mensagem..."
                        rows={5}
                        className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
                        style={{ background: "#111", borderColor: "#2a2a2a", borderRadius: 8 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                      <button
                        onClick={handleSendEmail}
                        disabled={busy || !emailMessage.trim()}
                        className="w-full font-body text-xs font-medium uppercase tracking-wider py-3 transition-opacity disabled:opacity-40"
                        style={{ background: GOLD, color: "#050505", borderRadius: 8 }}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Enviar Email →"}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SECTION 2 — CHAMADA COM IA */}
            {showCall && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
              >
                <p
                  className="font-body uppercase mb-2.5"
                  style={{ color: GOLD, fontSize: 10, letterSpacing: "0.12em" }}
                >
                  Chamada com Inteligência Artificial
                </p>
                <div
                  className="p-4 space-y-3"
                  style={{ background: "#1a1a1a", border: "1px solid #c9a84c33", borderRadius: 12 }}
                >
                  <p
                    className="font-body text-xs italic flex items-start gap-1.5"
                    style={{ color: "#888" }}
                  >
                    <Zap className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                    A IA irá contactar o cliente autonomamente em nome da House of Fades
                  </p>

                  <label
                    className="font-body uppercase block"
                    style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, letterSpacing: "0.12em" }}
                  >
                    Descreva o motivo da chamada
                  </label>
                  <Textarea
                    value={callTask}
                    onChange={(e) => setCallTask(e.target.value)}
                    placeholder="Ex: O barbeiro Mario ficou doente e precisamos remarcar a consulta de amanhã às 14:00..."
                    className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
                    style={{
                      background: "#111",
                      borderColor: "#2a2a2a",
                      borderRadius: 8,
                      minHeight: 80,
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />

                  {callState === "loading" && (
                    <div
                      className="flex items-center justify-center gap-2 py-3 font-body text-xs"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      A ligar para {target.client_name}...
                    </div>
                  )}

                  {callState === "success" && (
                    <div
                      className="w-full font-body text-xs font-medium uppercase tracking-wider py-3 flex items-center justify-center gap-2"
                      style={{ background: "#1a3a1a", color: "#4ade80", borderRadius: 8 }}
                    >
                      <Check className="h-4 w-4" />
                      Chamada iniciada
                    </div>
                  )}

                  {callState === "error" && (
                    <div
                      className="w-full font-body text-xs py-3 text-center"
                      style={{ background: "#3a1a1a", color: "#f87171", borderRadius: 8 }}
                    >
                      Erro ao iniciar chamada. Tente novamente.
                    </div>
                  )}

                  {callState === "idle" && (
                    <button
                      onClick={handleCall}
                      disabled={!callTask.trim()}
                      className="w-full font-body text-xs font-medium uppercase tracking-wider py-3 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: GOLD, color: "#111", borderRadius: 8 }}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Iniciar Chamada com IA →
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactClientModal;