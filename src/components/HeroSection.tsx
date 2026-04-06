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
        ctx.fillStyle = `rgba(212, 175, 55, ${p.opacity})`;
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
        <circle cx="25" cy="75" r="12" stroke="#d4af37" strokeWidth="2.5" fill="none" />
        <circle cx="75" cy="75" r="12" stroke="#d4af37" strokeWidth="2.5" fill="none" />
        <line x1="25" y1="63" x2="55" y2="25" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="75" y1="63" x2="45" y2="25" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="42" r="3" fill="#d4af37" />
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
      style={{ background: "radial-gradient(circle at 50% 40%, hsl(var(--card)) 0%, hsl(var(--background)) 55%, hsl(var(--background)) 100%)" }}
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
            className="mb-6 font-body text-xs uppercase tracking-[0.5em] text-accent"
          >
            {t("hero.est")}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.3, ease: easeOutExpo }}
            className="gold-title-gradient max-w-3xl font-serif text-6xl font-bold leading-[0.9] md:text-8xl lg:text-[7rem]"
          >
            {t("hero.title")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.65, ease: easeOutExpo }}
            className="mt-8 max-w-xl font-body text-lg leading-relaxed text-foreground/72 md:text-xl"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.95, ease: easeOutExpo }}
            className="mt-10 flex flex-col gap-4 sm:flex-row"
          >
            <motion.button
              onClick={onBookNow}
              whileHover={{ scale: 1.05, boxShadow: "0 0 40px hsla(43, 74%, 52%, 0.32)" }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary-glow btn-book-pulse rounded px-10 py-4 font-body text-sm font-semibold uppercase tracking-[0.05em] text-primary-foreground"
            >
              {t("nav.bookNow")}
            </motion.button>
            <motion.a
              href="#services"
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px hsla(43, 74%, 52%, 0.14)" }}
              whileTap={{ scale: 0.98 }}
              className="btn-gold-outline inline-flex items-center justify-center rounded px-10 py-4 font-body text-sm font-semibold uppercase tracking-[0.05em]"
            >
              {t("hero.exploreServices")}
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
