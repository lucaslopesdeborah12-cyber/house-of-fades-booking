import { useState, useEffect } from "react";

const LoadingScreen = ({ onDone }: { onDone: () => void }) => {
  const [phase, setPhase] = useState<"in" | "out" | "done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 1400);
    const t2 = setTimeout(() => { setPhase("done"); onDone(); }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transition: "opacity 0.8s ease-out",
      }}
    >
      <h1
        className="font-serif text-5xl md:text-7xl font-bold gold-title-gradient tracking-[0.05em]"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateY(0)" : "translateY(-20px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}
      >
        House of Fades
      </h1>
    </div>
  );
};

export default LoadingScreen;
