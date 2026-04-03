import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FadeInStagger from "./FadeInStagger";

type Service = { id: string; name: string; duration_minutes: number; price: number };
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const ServicesSection = ({ onBookNow }: { onBookNow?: () => void }) => {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    supabase.from("services").select("id, name, duration_minutes, price").order("created_at").then(({ data }) => {
      if (data) setServices(data);
    });
  }, []);

  return (
    <section id="services" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: easeOutExpo }}
          className="mb-16 max-w-2xl"
        >
          <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">Services</p>
          <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">Crafted cuts, beard work and refined detail.</h2>
        </motion.div>

        <FadeInStagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <motion.div
              key={s.id}
              onClick={onBookNow}
              whileHover={{ y: -8, scale: 1.01, boxShadow: "0 20px 60px hsla(43, 74%, 52%, 0.12)" }}
              transition={{ duration: 0.3 }}
              className="glass-card card-shimmer-border cursor-pointer rounded-lg p-7"
            >
              <div className="mb-8 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
                  <Scissors size={18} className="text-accent" />
                </div>
                <span className="font-serif text-2xl font-bold text-accent">€{Number(s.price).toFixed(0)}</span>
              </div>

              <h3 className="font-serif text-2xl font-semibold text-foreground">{s.name}</h3>
              <div className="mt-3 flex items-center gap-2 font-body text-sm text-muted-foreground">
                <Clock size={14} />
                <span>{s.duration_minutes} min</span>
              </div>
            </motion.div>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
};

export default ServicesSection;
