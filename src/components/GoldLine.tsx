import { useEffect, useRef, useState } from "react";

const GoldLine = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex justify-center mb-6">
      <div
        className="h-[1px] transition-all duration-1000 ease-out"
        style={{
          width: visible ? "80px" : "0px",
          background: "linear-gradient(90deg, transparent, hsl(43, 52%, 54%), transparent)",
        }}
      />
    </div>
  );
};

export default GoldLine;
