import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      <img
        src={heroBg}
        alt="Lopes barbershop interior"
        className="absolute inset-0 w-full h-full object-cover"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-background/75" />

      <div className="relative z-10 text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-muted-foreground text-sm tracking-[0.3em] uppercase mb-4 font-body">
            EST. 2025 — Carlow, Ireland
          </p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
            House
          </h1>
          <p className="text-foreground text-lg md:text-xl font-body mb-10 max-w-md mx-auto">
            Premium cuts. No compromises.
          </p>
          <a
            href="#services"
            className="inline-block bg-primary text-primary-foreground px-8 py-4 rounded text-lg font-medium hover:bg-primary/80 transition-colors font-body"
          >
            Book Now
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
