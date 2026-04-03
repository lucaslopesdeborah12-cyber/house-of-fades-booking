import { useState, useEffect } from "react";

const LoadingScreen = ({ onDone }: { onDone: () => void }) => {
  const [phase, setPhase] = useState<"in" | "out" | "done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 900);
    const t2 = setTimeout(() => {
      setPhase("done");
      onDone();
    }, 1450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transition: "opacity 0.55s ease-out",
      }}
    >
      <h1
        className="gold-title-gradient font-serif text-5xl font-bold tracking-[-0.02em] md:text-7xl"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateY(0)" : "translateY(-16px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >
        House of Fades
      </h1>
    </div>
  );
};

export default LoadingScreen;
