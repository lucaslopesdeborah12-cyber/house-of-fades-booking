import { Suspense } from "react";
import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import FloatingScissors from "./FloatingScissors";
import GoldParticles from "./GoldParticles";

const HeroSection = () => {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #0a0a0a 0%, #0a0a0a 60%, #1a0505 100%)" }}
    >
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={0.3} />
          <pointLight position={[5, 5, 5]} intensity={1} color="#C9A84C" />
          <pointLight position={[-5, -3, 3]} intensity={0.5} color="#8B1A1A" />
          <Suspense fallback={null}>
            <FloatingScissors />
            <GoldParticles />
          </Suspense>
        </Canvas>
      </div>

      {/* Content overlay */}
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
          className="font-serif text-6xl md:text-8xl lg:text-9xl font-bold mb-6 leading-tight gold-shimmer"
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
        <motion.a
          href="#services"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.3 }}
          className="inline-block btn-primary-glow text-primary-foreground px-10 py-4 rounded text-lg font-medium font-body"
          style={{ animation: "pulse-glow 3s ease-in-out infinite" }}
        >
          Book Now
        </motion.a>
      </div>
    </section>
  );
};

export default HeroSection;
