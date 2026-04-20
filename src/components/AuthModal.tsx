import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (guest?: { name: string; phone: string }) => void;
}

const ScissorsIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#C9A84C"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: "scissorsSpin 6s linear infinite", display: "block", margin: "0 auto" }}
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const AuthModal = ({ open, onOpenChange, onContinue }: AuthModalProps) => {
  const [view, setView] = useState<"home" | "guest" | "register" | "otp" | "success">("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpShake, setOtpShake] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const reset = () => {
    setEmail(""); setPassword(""); setName("");
    setPhone(""); setGuestName(""); setGuestPhone("");
    setOtp(["", "", "", "", "", ""]); setOtpShake(false); setResendCooldown(0);
    setError(""); setLoading(false); setView("home");
  };

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      reset();
      onContinue();
    } catch (err: any) {
      setError(err.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(""); setLoading(true);
    try {
      if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
        throw new Error("Preencha todos os campos");
      }
      if (password.length < 6) throw new Error("Password mínima de 6 caracteres");
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { full_name: name, phone, pending_password: password },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (err) throw err;
      setOtp(["", "", "", "", "", ""]);
      setView("otp");
      startResendCooldown();
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { full_name: name, phone, pending_password: password },
      },
    });
    if (err) setError(err.message);
    else { toast.success("Código reenviado"); startResendCooldown(); }
  };

  const handleOtpChange = (idx: number, val: string) => {
    const ch = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = ch;
    setOtp(next);
    if (ch && idx < 5) {
      const el = document.getElementById(`otp-${idx + 1}`);
      el?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      const el = document.getElementById(`otp-${idx - 1}`);
      el?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) { setError("Insira os 6 dígitos"); return; }
    setError(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email, token: code, type: "email",
      });
      if (err) throw err;
      // Set the password they chose (account is now confirmed + signed in)
      if (password) {
        await supabase.auth.updateUser({
          password,
          data: { full_name: name, phone },
        });
      }
      setView("success");
      setTimeout(() => { reset(); onContinue(); }, 2000);
    } catch (err: any) {
      setError("Código incorreto. Tente novamente.");
      setOtpShake(true);
      setTimeout(() => setOtpShake(false), 500);
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("otp-0")?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleGuestConfirm = () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      setError("Preencha nome e telefone");
      return;
    }
    const guest = { name: guestName.trim(), phone: guestPhone.trim() };
    reset();
    onContinue(guest);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError("Insira o seu email primeiro"); return; }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(err.message);
    else toast.success("Email de recuperação enviado!");
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const inputStyle: React.CSSProperties = {
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: "13px 14px",
    fontSize: 14,
    color: "#e8e8e8",
    outline: "none",
    width: "100%",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: "rgba(201,168,76,0.6)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "Inter, sans-serif",
    marginBottom: 6,
    display: "block",
    fontWeight: 500,
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="auth-modal-content p-0 overflow-hidden border-0"
        style={{
          maxWidth: 400,
          background: "#111",
          border: "1px solid #2a2a2a",
          borderRadius: 18,
        }}
      >
        <style>{`
          @keyframes scissorsSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes guestBannerPulse {
            0%, 100% { border-color: rgba(201,168,76,0.33); box-shadow: 0 0 0 0 rgba(201,168,76,0.0); }
            50% { border-color: rgba(201,168,76,1); box-shadow: 0 0 18px 2px rgba(201,168,76,0.18); }
          }
          .guest-banner { animation: guestBannerPulse 3s ease-in-out infinite; }
          .auth-input:focus { border-color: rgba(201,168,76,0.53) !important; }
          @keyframes otpShake {
            0%,100% { transform: translateX(0); }
            20%,60% { transform: translateX(-6px); }
            40%,80% { transform: translateX(6px); }
          }
          .otp-shake { animation: otpShake 0.45s ease-in-out; }
          .otp-box:focus { border-color: #C9A84C !important; outline: none; }
          @keyframes successPop {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", padding: "26px 24px 6px" }}>
            <ScissorsIcon />
            <div style={{
              fontSize: 22, color: "#C9A84C",
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: 1, marginTop: 10, fontWeight: 600,
            }}>
              House of Fades
            </div>
            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.35)",
              fontFamily: "Inter, sans-serif", marginTop: 4, letterSpacing: 0.5,
            }}>
              Carlow, Ireland
            </div>
          </div>

          <AnimatePresence mode="wait">
            {view === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                {/* Guest banner */}
                <div style={{ padding: "18px 24px 0" }}>
                  <div
                    className="guest-banner"
                    style={{
                      background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))",
                      border: "1.5px solid rgba(201,168,76,0.5)",
                      borderRadius: 14,
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 14, color: "#fff", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                      <span style={{ marginRight: 6 }}>⚡</span>Não tem conta? Sem problema!
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "Inter, sans-serif", marginTop: 4 }}>
                      Agende diretamente — rápido e sem registo obrigatório
                    </div>
                  </div>

                  <button
                    onClick={() => { setError(""); setView("guest"); }}
                    style={{
                      marginTop: 12, width: "100%",
                      background: "#C9A84C", border: "none", borderRadius: 14,
                      padding: 14, fontSize: 14, fontWeight: 700, color: "#111",
                      fontFamily: "Inter, sans-serif", letterSpacing: 0.3, cursor: "pointer",
                      transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(201,168,76,0.35)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    ⚡ Agendar sem conta →
                  </button>
                </div>

                {/* Divider */}
                <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "Inter, sans-serif", letterSpacing: 0.5 }}>
                    ou entre na sua conta
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
                </div>

                {/* Login form */}
                <div style={{ padding: "16px 24px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>EMAIL</label>
                    <input
                      type="email" className="auth-input"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@gmail.com" style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>PASSWORD</label>
                    <input
                      type="password" className="auth-input"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" style={inputStyle}
                    />
                  </div>
                  <div
                    onClick={handleForgotPassword}
                    style={{
                      textAlign: "right", fontSize: 11, color: "#C9A84C",
                      fontFamily: "Inter, sans-serif", cursor: "pointer", marginTop: -4,
                    }}
                  >
                    Esqueceu a senha?
                  </div>
                </div>

                {error && (
                  <div style={{
                    margin: "10px 24px 0", padding: "9px 12px",
                    background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.25)",
                    borderRadius: 10, fontSize: 11, color: "#ff7b7b", fontFamily: "Inter, sans-serif",
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ padding: "14px 24px 0" }}>
                  <button
                    onClick={handleLogin} disabled={loading}
                    style={{
                      width: "100%", background: "transparent",
                      border: "1px solid #3a3a3a", borderRadius: 14, padding: 13,
                      fontSize: 13, fontWeight: 500, color: "#e0e0e0",
                      fontFamily: "Inter, sans-serif", cursor: loading ? "not-allowed" : "pointer",
                      transition: "border-color 0.2s, color 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.color = "#C9A84C"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#3a3a3a"; e.currentTarget.style.color = "#e0e0e0"; }}
                  >
                    {loading ? "A entrar..." : "Entrar →"}
                  </button>
                </div>

                <div style={{
                  textAlign: "center", padding: "14px 24px 22px",
                  fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif",
                }}>
                  Não tem conta?{" "}
                  <span
                    style={{ color: "#C9A84C", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
                    onClick={() => { setError(""); setView("register"); }}
                  >
                    Criar agora
                  </span>
                </div>
              </motion.div>
            )}

            {view === "guest" && (
              <motion.div
                key="guest"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ padding: "18px 24px 0" }}>
                  <button
                    onClick={() => { setError(""); setView("home"); }}
                    style={{
                      background: "transparent", border: "none", color: "rgba(255,255,255,0.5)",
                      cursor: "pointer", fontSize: 12, fontFamily: "Inter, sans-serif",
                      padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    ← Voltar
                  </button>

                  <div style={{ fontSize: 16, color: "#fff", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 4 }}>
                    Agendar sem conta
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif", marginBottom: 16 }}>
                    Só precisamos do seu nome e telefone
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>PRIMEIRO NOME</label>
                      <input
                        className="auth-input"
                        value={guestName} onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Mario" style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>TELEFONE</label>
                      <input
                        type="tel" className="auth-input"
                        value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+353 ..." style={inputStyle}
                      />
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      marginTop: 12, padding: "9px 12px",
                      background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.25)",
                      borderRadius: 10, fontSize: 11, color: "#ff7b7b", fontFamily: "Inter, sans-serif",
                    }}>
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleGuestConfirm}
                    style={{
                      marginTop: 16, marginBottom: 22, width: "100%",
                      background: "#C9A84C", border: "none", borderRadius: 14,
                      padding: 14, fontSize: 14, fontWeight: 700, color: "#111",
                      fontFamily: "Inter, sans-serif", letterSpacing: 0.3, cursor: "pointer",
                      transition: "box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(201,168,76,0.35)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                  >
                    Confirmar marcação →
                  </button>
                </div>
              </motion.div>
            )}

            {view === "register" && (
              <motion.div
                key="register"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ padding: "18px 24px 0" }}>
                  <button
                    onClick={() => { setError(""); setView("home"); }}
                    style={{
                      background: "transparent", border: "none", color: "rgba(255,255,255,0.5)",
                      cursor: "pointer", fontSize: 12, fontFamily: "Inter, sans-serif",
                      padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    ← Voltar
                  </button>

                  <div style={{ fontSize: 16, color: "#fff", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 16 }}>
                    Criar nova conta
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>NOME</label>
                      <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>EMAIL</label>
                      <input type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@gmail.com" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>TELEFONE</label>
                      <input type="tel" className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+353 xx xxx xxxx" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>PASSWORD</label>
                      <input type="password" className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      marginTop: 12, padding: "9px 12px",
                      background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.25)",
                      borderRadius: 10, fontSize: 11, color: "#ff7b7b", fontFamily: "Inter, sans-serif",
                    }}>
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleRegister} disabled={loading}
                    style={{
                      marginTop: 16, marginBottom: 22, width: "100%",
                      background: "#C9A84C", border: "none", borderRadius: 14,
                      padding: 14, fontSize: 14, fontWeight: 700, color: "#111",
                      fontFamily: "Inter, sans-serif", letterSpacing: 0.3,
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    {loading ? "A criar..." : "Criar conta →"}
                  </button>
                </div>
              </motion.div>
            )}

            {view === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ padding: "18px 24px 22px" }}>
                  <button
                    onClick={() => { setError(""); setView("register"); }}
                    style={{
                      background: "transparent", border: "none", color: "rgba(255,255,255,0.5)",
                      cursor: "pointer", fontSize: 12, fontFamily: "Inter, sans-serif",
                      padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    ← Voltar
                  </button>

                  <div style={{ textAlign: "center", marginBottom: 18 }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" style={{ margin: "0 auto", display: "block" }}>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <polyline points="3,7 12,13 21,7" />
                    </svg>
                    <div style={{ fontSize: 17, color: "#fff", fontFamily: "'Playfair Display', Georgia, serif", marginTop: 12 }}>
                      Verifique o seu email
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif", marginTop: 6 }}>
                      Enviámos um código de 6 dígitos para <span style={{ color: "#C9A84C" }}>{email}</span>
                    </div>
                  </div>

                  <div className={otpShake ? "otp-shake" : ""} style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14 }}>
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        className="otp-box"
                        value={d}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        inputMode="numeric"
                        maxLength={1}
                        style={{
                          width: 40, height: 48, textAlign: "center",
                          background: "#1c1c1c", border: "1px solid #2a2a2a",
                          borderRadius: 10, color: "#fff", fontSize: 20, fontWeight: 600,
                          fontFamily: "Inter, sans-serif",
                        }}
                      />
                    ))}
                  </div>

                  {error && (
                    <div style={{
                      margin: "0 0 12px", padding: "9px 12px",
                      background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.25)",
                      borderRadius: 10, fontSize: 11, color: "#ff7b7b", fontFamily: "Inter, sans-serif", textAlign: "center",
                    }}>{error}</div>
                  )}

                  <button
                    onClick={handleVerifyOtp} disabled={loading}
                    style={{
                      width: "100%", background: "#C9A84C", border: "none", borderRadius: 14,
                      padding: 14, fontSize: 14, fontWeight: 700, color: "#111",
                      fontFamily: "Inter, sans-serif", cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    {loading ? "A verificar..." : "Confirmar código →"}
                  </button>

                  <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, fontFamily: "Inter, sans-serif", color: "rgba(255,255,255,0.4)" }}>
                    Não recebeu?{" "}
                    <span
                      onClick={handleResendOtp}
                      style={{
                        color: resendCooldown > 0 ? "rgba(201,168,76,0.4)" : "#C9A84C",
                        cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                        textDecoration: "underline", textUnderlineOffset: 2,
                      }}
                    >
                      {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {view === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ padding: "30px 24px 40px", textAlign: "center" }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%",
                    background: "rgba(201,168,76,0.12)", border: "2px solid #C9A84C",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto", animation: "successPop 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 18, color: "#fff", fontFamily: "'Playfair Display', Georgia, serif", marginTop: 18 }}>
                    Conta criada com sucesso!
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif", marginTop: 6 }}>
                    Bem-vindo à House of Fades
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
