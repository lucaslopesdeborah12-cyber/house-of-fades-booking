import { useEffect, useRef } from "react";

const CursorGlow = () => {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX - 150}px, ${e.clientY - 150}px)`;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={glowRef}
      className="pointer-events-none fixed top-0 left-0 z-[9999] w-[300px] h-[300px] rounded-full opacity-20 mix-blend-screen"
      style={{
        background: "radial-gradient(circle, hsla(43, 52%, 54%, 0.35) 0%, transparent 70%)",
        transition: "transform 0.15s ease-out",
      }}
    />
  );
};

export default CursorGlow;
