import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const GoldParticlesCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const particles: { x: number; y: number; speed: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        speed: 0.2 + Math.random() * 0.8,
        size: 1 + Math.random() * 2.5,
        opacity: 0.15 + Math.random() * 0.45,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < -10) {
          p.y = canvas.offsetHeight + 10;
          p.x = Math.random() * canvas.offsetWidth;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201, 168, 76, ${p.opacity})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    const cleanup = draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => {
      cleanup?.();
      window.removeEventListener("resize", handleResize);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none z-0" />;
};

const GoldScissors = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0" style={{ perspective: "1000px" }}>
    <div className="scissors-3d-rotate opacity-10 blur-[0.2px]">
      <svg width="380" height="380" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="25" cy="75" r="12" stroke="#c9a84c" strokeWidth="2.5" fill="none" />
        <circle cx="75" cy="75" r="12" stroke="#c9a84c" strokeWidth="2.5" fill="none" />
        <line x1="25" y1="63" x2="55" y2="25" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="75" y1="63" x2="45" y2="25" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="42" r="3" fill="#c9a84c" />
      </svg>
    </div>
  </div>
);

const HeroSection = ({ onBookNow }: { onBookNow?: () => void }) => {
  const { t } = useLanguage();

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden"
      style={{ background: "radial-gradient(circle at 50% 40%, hsl(var(--card)) 0%, #050505 55%, #050505 100%)" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,_hsla(0,68%,33%,0.18),_transparent_35%),radial-gradient(circle_at_right,_hsla(0,68%,33%,0.14),_transparent_30%)]" />
      <GoldParticlesCanvas />
      <GoldScissors />

      <div className="container relative z-10 mx-auto flex min-h-screen items-center px-4 pt-24 pb-12">
        <div className="max-w-4xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: easeOutExpo }}
            className="mb-6 font-sans text-[10px] font-light uppercase tracking-[0.5em] text-[#c9a84c]/60"
          >
            {t("hero.est")}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.3, ease: easeOutExpo }}
            className="max-w-3xl font-serif text-5xl font-bold italic leading-[0.92] sm:text-6xl md:text-8xl lg:text-[7.5rem]"
            style={{ color: '#c9a84c' }}
          >
            THE ART<br />
            <span className="font-cormorant not-italic font-light text-[0.55em] tracking-[0.08em] text-foreground/40">of the</span><br />
            CUT.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.65, ease: easeOutExpo }}
            className="mt-10 max-w-md font-cormorant text-xl italic leading-relaxed text-foreground/50 md:text-2xl"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.95, ease: easeOutExpo }}
            className="mt-12 flex flex-col gap-4 sm:flex-row"
          >
            <motion.button
              onClick={onBookNow}
              whileHover={{ scale: 1.05, boxShadow: "0 0 40px hsla(43, 74%, 52%, 0.32)" }}
              whileTap={{ scale: 0.98 }}
              className="btn-book-pulse px-12 py-4 font-sans text-[11px] font-medium uppercase text-[#050505]"
              style={{
                background: '#c9a84c',
                letterSpacing: '4px',
                borderRadius: 0,
              }}
            >
              {t("hero.bookCta")}
            </motion.button>
            <motion.a
              href="#services"
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px hsla(43, 74%, 52%, 0.14)" }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center px-12 py-4 font-sans text-[11px] font-medium uppercase text-[#c9a84c]"
              style={{
                border: '0.5px solid #c9a84c',
                letterSpacing: '4px',
                borderRadius: 0,
                background: 'transparent',
              }}
            >
              {t("hero.exploreCta")}
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
