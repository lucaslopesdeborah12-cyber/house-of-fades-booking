import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

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
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        speed: 0.3 + Math.random() * 0.7,
        size: 1 + Math.random() * 2,
        opacity: 0.2 + Math.random() * 0.5,
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

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 pointer-events-none" />;
};

/* CSS-animated gold scissors with 3D rotation */
const GoldScissors = () => (
  <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none" style={{ perspective: "800px" }}>
    <div className="opacity-10 scissors-3d-rotate">
      <svg width="300" height="300" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="25" cy="75" r="12" stroke="#C9A84C" strokeWidth="2.5" fill="none" />
        <circle cx="75" cy="75" r="12" stroke="#C9A84C" strokeWidth="2.5" fill="none" />
        <line x1="25" y1="63" x2="55" y2="25" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="75" y1="63" x2="45" y2="25" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="42" r="3" fill="#C9A84C" />
      </svg>
    </div>
  </div>
);

const HeroSection = ({ onBookNow }: { onBookNow?: () => void }) => {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #0a0a0a 0%, #0a0a0a 60%, #1a0505 100%)" }}
    >
      <GoldParticlesCanvas />
      <GoldScissors />

      <div className="relative z-10 text-center px-4">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-accent text-sm tracking-[0.4em] uppercase mb-6 font-body"
        >
          EST. 2025 — Carlow, Ireland
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="font-serif text-6xl md:text-8xl lg:text-9xl font-bold mb-6 leading-tight gold-title-gradient"
        >
          House of Fades
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="text-foreground text-lg md:text-xl font-body mb-12 max-w-md mx-auto"
        >
          Premium cuts. No compromises.
        </motion.p>
        <motion.button
          onClick={onBookNow}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.3 }}
          className="inline-block btn-primary-glow btn-book-pulse text-primary-foreground px-10 py-4 rounded text-lg font-medium font-body"
        >
          Book Now
        </motion.button>
      </div>
    </section>
  );
};

export default HeroSection;
