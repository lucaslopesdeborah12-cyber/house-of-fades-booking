import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

const AuthModal = ({ open, onOpenChange, onContinue }: AuthModalProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setMode('login');
    setLoading(false);
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (err) throw err;
        toast.success("Conta criada! Verifique o seu email.");
      }
      resetForm();
      onContinue();
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Insira o seu email primeiro');
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) {
      setError(err.message);
    } else {
      toast.success("Email de recuperação enviado!");
    }
  };

  const handleGuest = () => {
    resetForm();
    onContinue();
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetForm();
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="auth-modal-content p-0 overflow-hidden border-0"
        style={{
          maxWidth: 380,
          background: '#111',
          border: '1.5px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
        }}
      >
        <div style={{ opacity: 0, animation: 'authFadeUp 0.4s ease forwards' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', padding: '20px 20px 8px' }}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>✂️</span>
            <div style={{ fontSize: 18, color: '#C9A84C', fontFamily: 'Georgia', letterSpacing: 1 }}>
              House of Fades
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', fontFamily: 'Arial', marginTop: 2 }}>
              Carlow, Ireland
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', padding: '0 20px 4px' }}>
            <div style={{ fontSize: 14, color: '#fff', fontFamily: 'Georgia' }}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: 'Arial', marginTop: 2 }}>
              {mode === 'login' ? 'Entre com o seu email e senha' : 'Preencha os dados abaixo'}
            </div>
          </div>

          {/* Form */}
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 8, color: 'rgba(201,168,76,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial', marginBottom: 3, display: 'block' }}>
                  NOME
                </label>
                <div className="auth-border-box">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome"
                    style={{
                      background: '#181818', border: 'none', borderRadius: 11,
                      padding: '13px 14px', fontSize: 13, color: '#e0e0e0',
                      outline: 'none', width: '100%', fontFamily: 'Arial',
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 8, color: 'rgba(201,168,76,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial', marginBottom: 3, display: 'block' }}>
                EMAIL
              </label>
              <div className="auth-border-box">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@gmail.com"
                  style={{
                    background: '#181818', border: 'none', borderRadius: 11,
                    padding: '13px 14px', fontSize: 13, color: '#e0e0e0',
                    outline: 'none', width: '100%', fontFamily: 'Arial',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 8, color: 'rgba(201,168,76,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial', marginBottom: 3, display: 'block' }}>
                PASSWORD
              </label>
              <div className="auth-border-box">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    background: '#181818', border: 'none', borderRadius: 11,
                    padding: '13px 14px', fontSize: 13, color: '#e0e0e0',
                    outline: 'none', width: '100%', fontFamily: 'Arial',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Forgot password */}
          {mode === 'login' && (
            <div
              style={{ textAlign: 'right', padding: '6px 20px 0', fontSize: 10, color: 'rgba(201,168,76,0.45)', fontFamily: 'Arial', cursor: 'pointer' }}
              onClick={handleForgotPassword}
            >
              Esqueceu a senha?
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '8px 12px', background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.2)',
              borderRadius: 8, fontSize: 11, color: '#ff6b6b', fontFamily: 'Arial', margin: '8px 20px 0',
            }}>
              {error}
            </div>
          )}

          {/* Confirm button */}
          <div style={{ margin: '12px 20px 0' }}>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                opacity: 0, animation: 'authFadeUp 0.42s ease forwards 0.15s',
                background: '#C9A84C', border: 'none', borderRadius: 14, padding: 14,
                width: '100%', fontSize: 15, fontWeight: 'bold', color: '#111',
                fontFamily: 'Georgia', letterSpacing: 0.3, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'A entrar...' : mode === 'login' ? 'Entrar →' : 'Criar conta →'}
            </button>
          </div>

          {/* Divider */}
          <div style={{ padding: '0 20px', margin: '12px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'Arial' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Guest button */}
          <div style={{ margin: '0 20px' }}>
            <button
              onClick={handleGuest}
              style={{
                opacity: 0, animation: 'authFadeUp 0.42s ease forwards 0.22s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 11, background: 'rgba(255,255,255,0.02)',
                border: '1px dashed rgba(255,255,255,0.09)', borderRadius: 12,
                cursor: 'pointer', transition: 'all 0.2s', width: '100%',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
            >
              <span style={{ fontSize: 14 }}>⚡</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Arial' }}>Continuar sem conta</span>
              <span style={{ fontSize: 14, color: 'rgba(201,168,76,0.4)' }}>›</span>
            </button>
          </div>

          {/* Toggle mode */}
          <div style={{
            opacity: 0, animation: 'authFadeUp 0.38s ease forwards 0.28s',
            textAlign: 'center', padding: '10px 20px 16px', fontSize: 11,
            color: 'rgba(255,255,255,0.22)', fontFamily: 'Arial',
          }}>
            {mode === 'login' ? (
              <>Não tem conta?{' '}<span style={{ color: '#C9A84C', cursor: 'pointer' }} onClick={() => { setMode('register'); setError(''); }}>Criar agora</span></>
            ) : (
              <>Já tem conta?{' '}<span style={{ color: '#C9A84C', cursor: 'pointer' }} onClick={() => { setMode('login'); setError(''); }}>Entrar</span></>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
