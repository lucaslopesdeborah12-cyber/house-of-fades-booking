import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MessageSquare, Mail, Phone, X, Zap, Check, User, Calendar, Scissors } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

export type CancelTarget = {
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

const buildMessage = (t: CancelTarget) => {
  const dateStr = format(parseISO(t.appointment_date), "dd/MM");
  const timeStr = t.time_slot.slice(0, 5);
  const serviceName = t.services?.name || "serviço";
  const barberName = t.barbers?.name || "o barbeiro";
  return `Olá ${t.client_name}, infelizmente temos de cancelar a sua marcação de ${dateStr} às ${timeStr} (${serviceName} com ${barberName}). Pedimos desculpa pelo inconveniente. Por favor contacte-nos para remarcar. — House of Fades, Carlow`;
};

const buildCallTask = (t: CancelTarget) => {
  const dateStr = format(parseISO(t.appointment_date), "dd/MM");
  const timeStr = t.time_slot.slice(0, 5);
  const serviceName = t.services?.name || "serviço";
  const barberName = t.barbers?.name || "o barbeiro";
  return `Ligar para ${t.client_name} para informar que a marcação de ${dateStr} às ${timeStr} para ${serviceName} com o barbeiro ${barberName} foi cancelada. Pedir desculpa pelo inconveniente e oferecer para remarcar.`;
};

const CancelAppointmentModal = ({
  target,
  onClose,
  onCancelled,
}: {
  target: CancelTarget | null;
  onClose: () => void;
  onCancelled: () => void;
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
  const [emailSubject, setEmailSubject] = useState("House of Fades — Cancelamento da sua marcação");
  const [emailMessage, setEmailMessage] = useState("");
  const [callTask, setCallTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [callState, setCallState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [smsSent, setSmsSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [callSent, setCallSent] = useState(false);
  const [confirmNoNotify, setConfirmNoNotify] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (target) {
      const baseMsg = buildMessage(target);
      setMsgTab(availableMsgTabs[0] || "sms");
      setSmsMessage(baseMsg);
      setEmailMessage(baseMsg);
      setEmailSubject("House of Fades — Cancelamento da sua marcação");
      setCallTask(buildCallTask(target));
      setCallState("idle");
      setSmsSent(false);
      setEmailSent(false);
      setCallSent(false);
      setConfirmNoNotify(false);
      setFinalizing(false);
    }
  }, [target?.id]);

  if (!target) return null;

  const dateStr = format(parseISO(target.appointment_date), "dd/MM");
  const timeStr = target.time_slot.slice(0, 5);
  const serviceName = target.services?.name || "—";
  const barberName = target.barbers?.name || "—";
  const anyNotified = smsSent || emailSent || callSent;

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
    if (!target.client_phone) { toast.error("Cliente não tem telefone"); return; }
    if (!smsMessage.trim()) { toast.error("Escreva uma mensagem"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { action: "custom", phone: target.client_phone, message: smsMessage.trim() },
      });
      if (error || !data?.success) throw new Error(error?.message || "SMS failed");
      await logContact("sms", smsMessage.trim(), "sent");
      setSmsSent(true);
      toast.success(`SMS enviado ✓`);
    } catch (e: any) {
      await logContact("sms", smsMessage.trim(), "failed", undefined, String(e?.message || e));
      toast.error("Falha ao enviar SMS");
    } finally { setBusy(false); }
  };

  const handleSendEmail = async () => {
    if (!target.client_email) { toast.error("Cliente não tem email"); return; }
    if (!emailMessage.trim()) { toast.error("Escreva uma mensagem"); return; }
    setBusy(true);
    try {
      ensureEmailJSInit();
      // EmailJS Service ID: service_y59db7l
      await emailjs.send("service_y59db7l", "template_7i3p8r9", {
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
      setEmailSent(true);
      toast.success(`Email enviado ✓`);
    } catch (e: any) {
      await logContact("email", emailMessage.trim(), "failed", emailSubject, String(e?.message || e));
      toast.error("Falha ao enviar email");
    } finally { setBusy(false); }
  };

  const handleCall = async () => {
    if (!target.client_phone) { toast.error("Cliente não tem telefone"); return; }
    if (!callTask.trim()) { toast.error("Descreva o motivo da chamada"); return; }
    setCallState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("contact-call", {
        body: { clientName: target.client_name, clientPhone: target.client_phone, task: callTask.trim() },
      });
      if (error || !data?.success) throw new Error(error?.message || "Call failed");
      await logContact("call", callTask.trim(), "sent");
      setCallState("success");
      setCallSent(true);
      setTimeout(() => setCallState("idle"), 4000);
    } catch (e: any) {
      await logContact("call", callTask.trim(), "failed", undefined, String(e?.message || e));
      setCallState("error");
      setTimeout(() => setCallState("idle"), 4000);
    }
  };

  const finalizeCancellation = async (notified: boolean) => {
    setFinalizing(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_notified: notified,
        } as any)
        .eq("id", target.id);
      if (error) throw error;
      toast.success("Agendamento cancelado ✓");
      onCancelled();
      onClose();
    } catch (e: any) {
      toast.error("Falha ao cancelar");
      setFinalizing(false);
    }
  };

  const tabMeta: Record<MsgTab, { label: string; icon: any }> = {
    sms: { label: "SMS", icon: MessageSquare },
    email: { label: "Email", icon: Mail },
  };

  const lockedClose = busy || callState === "loading" || finalizing;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !lockedClose && onClose()}>
      <DialogContent
        className="border p-0 text-white max-h-[90vh] overflow-y-auto [&>button]:hidden"
        style={{ background: "#111", borderRadius: 16, borderColor: "#2a2a2a", maxWidth: 520 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="p-7"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <DialogTitle className="font-body text-base font-medium text-white">
              Cancelar Agendamento
            </DialogTitle>
            <button
              onClick={() => !lockedClose && onClose()}
              className="text-[#555] hover:text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* SECTION 0 — INFO */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
            >
              <p className="font-body uppercase mb-2.5" style={{ color: GOLD, fontSize: 10, letterSpacing: "0.12em" }}>
                Informação do Agendamento
              </p>
              <div className="p-4 space-y-2 font-body text-sm" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12 }}>
                <div className="flex items-center gap-2"><User className="h-4 w-4" style={{ color: GOLD }} /><span className="text-white">{target.client_name}</span></div>
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4" style={{ color: GOLD }} /><span className="text-white">{dateStr} · {timeStr}</span></div>
                <div className="flex items-center gap-2"><Scissors className="h-4 w-4" style={{ color: GOLD }} /><span className="text-white">{serviceName} · {barberName}</span></div>
                <div className="flex items-center gap-2"><Mail className="h-4 w-4" style={{ color: GOLD }} /><span className={target.client_email ? "text-white" : "text-[#555]"}>{target.client_email || "Não disponível"}</span></div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4" style={{ color: GOLD }} /><span className={target.client_phone ? "text-white" : "text-[#555]"}>{target.client_phone || "Não disponível"}</span></div>
              </div>
            </motion.div>

            <p className="font-body uppercase" style={{ color: GOLD, fontSize: 10, letterSpacing: "0.12em" }}>
              Notificar o Cliente
            </p>

            {/* SECTION 1 — MENSAGEM DIRETA */}
            {availableMsgTabs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
              >
                <p className="font-body uppercase mb-2.5" style={{ color: GOLD, fontSize: 10, letterSpacing: "0.12em" }}>
                  Mensagem Direta
                </p>
                <div className="p-4" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12 }}>
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
                          {((tk === "sms" && smsSent) || (tk === "email" && emailSent)) && (
                            <Check className="h-3 w-3" style={{ color: "#4ade80" }} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {msgTab === "sms" && (
                    <div className="space-y-3">
                      <Textarea
                        value={smsMessage}
                        onChange={(e) => setSmsMessage(e.target.value)}
                        rows={5}
                        className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
                        style={{ background: "#111", borderColor: "#2a2a2a", borderRadius: 8 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                      {smsSent ? (
                        <div className="w-full py-3 flex items-center justify-center gap-2 font-body text-xs uppercase tracking-wider"
                          style={{ background: "#1a3a1a", color: "#4ade80", borderRadius: 8 }}>
                          <Check className="h-4 w-4" /> Mensagem enviada
                        </div>
                      ) : (
                        <button
                          onClick={handleSendSMS}
                          disabled={busy || !smsMessage.trim()}
                          className="w-full font-body text-xs font-medium uppercase tracking-wider py-3 transition-opacity disabled:opacity-40"
                          style={{ background: GOLD, color: "#050505", borderRadius: 8 }}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Enviar SMS →"}
                        </button>
                      )}
                    </div>
                  )}

                  {msgTab === "email" && (
                    <div className="space-y-3">
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ background: "#111", borderColor: "#2a2a2a", borderRadius: 8 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                      <Textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={5}
                        className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
                        style={{ background: "#111", borderColor: "#2a2a2a", borderRadius: 8 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                      {emailSent ? (
                        <div className="w-full py-3 flex items-center justify-center gap-2 font-body text-xs uppercase tracking-wider"
                          style={{ background: "#1a3a1a", color: "#4ade80", borderRadius: 8 }}>
                          <Check className="h-4 w-4" /> Mensagem enviada
                        </div>
                      ) : (
                        <button
                          onClick={handleSendEmail}
                          disabled={busy || !emailMessage.trim()}
                          className="w-full font-body text-xs font-medium uppercase tracking-wider py-3 transition-opacity disabled:opacity-40"
                          style={{ background: GOLD, color: "#050505", borderRadius: 8 }}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Enviar Email →"}
                        </button>
                      )}
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
                transition={{ duration: 0.3, delay: 0.25, ease: "easeOut" }}
              >
                <p className="font-body uppercase mb-2.5" style={{ color: GOLD, fontSize: 10, letterSpacing: "0.12em" }}>
                  Chamada com IA
                </p>
                <div className="p-4 space-y-3" style={{ background: "#1a1a1a", border: "1px solid #c9a84c33", borderRadius: 12 }}>
                  <p className="font-body text-xs italic flex items-start gap-1.5" style={{ color: "#888" }}>
                    <Zap className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                    A IA irá contactar o cliente autonomamente em nome da House of Fades para explicar o cancelamento
                  </p>
                  <label className="font-body uppercase block" style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, letterSpacing: "0.12em" }}>
                    Motivo da chamada
                  </label>
                  <Textarea
                    value={callTask}
                    onChange={(e) => setCallTask(e.target.value)}
                    className="border text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
                    style={{ background: "#111", borderColor: "#2a2a2a", borderRadius: 8, minHeight: 80 }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c88")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                  {callState === "loading" && (
                    <div className="flex items-center justify-center gap-2 py-3 font-body text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      A ligar para {target.client_name}...
                    </div>
                  )}
                  {callState === "success" && (
                    <div className="w-full font-body text-xs font-medium uppercase tracking-wider py-3 flex items-center justify-center gap-2"
                      style={{ background: "#1a3a1a", color: "#4ade80", borderRadius: 8 }}>
                      <Check className="h-4 w-4" /> Chamada iniciada
                    </div>
                  )}
                  {callState === "error" && (
                    <div className="w-full font-body text-xs py-3 text-center" style={{ background: "#3a1a1a", color: "#f87171", borderRadius: 8 }}>
                      Erro ao iniciar chamada. Tente novamente.
                    </div>
                  )}
                  {callState === "idle" && !callSent && (
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

            {/* Footer */}
            <div className="pt-4 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "#2a2a2a" }}>
              <AnimatePresence mode="wait">
                {confirmNoNotify ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="font-body text-xs text-white/60">Tens a certeza?</span>
                    <button
                      onClick={() => finalizeCancellation(false)}
                      disabled={finalizing}
                      className="font-body text-xs uppercase tracking-wider px-3 py-2 disabled:opacity-40"
                      style={{ color: "#f87171" }}
                    >
                      {finalizing ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Sim, cancelar"}
                    </button>
                    <button
                      onClick={() => setConfirmNoNotify(false)}
                      className="font-body text-xs uppercase tracking-wider px-3 py-2 text-white/40 hover:text-white"
                    >
                      Não
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="no-notify"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setConfirmNoNotify(true)}
                    className="font-body text-xs uppercase tracking-wider text-white/40 hover:text-white/70 transition-colors"
                  >
                    Cancelar sem notificar
                  </motion.button>
                )}
              </AnimatePresence>

              <button
                onClick={() => finalizeCancellation(true)}
                disabled={!anyNotified || finalizing || confirmNoNotify}
                className="font-body text-xs font-medium uppercase tracking-wider px-5 py-3 transition-opacity disabled:opacity-40"
                style={{ background: GOLD, color: "#050505", borderRadius: 8 }}
              >
                {finalizing ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Confirmar cancelamento →"}
              </button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelAppointmentModal;