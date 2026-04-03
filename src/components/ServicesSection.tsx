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
    <section id="services" className="py-20 md:py-[120px] px-4">
      <div className="container mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOutExpo }} className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 gold-title-gradient">Our Services</h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto">Expert grooming tailored to your style</p>
        </motion.div>

        <FadeInStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s) => (
            <motion.div
              key={s.id}
              onClick={onBookNow}
              whileHover={{ y: -6, boxShadow: "0 0 30px hsla(43, 74%, 52%, 0.15)" }}
              transition={{ duration: 0.3 }}
              className="glass-card rounded-lg p-6 flex items-center justify-between cursor-pointer group card-shimmer-border"
            >
              <div className="flex items-center gap-4">
                <Scissors size={18} className="text-accent opacity-40 group-hover:opacity-100 transition-opacity duration-300" />
                <div>
                  <h3 className="font-serif text-lg font-semibold">{s.name}</h3>
                  <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1 font-body">
                    <Clock size={14} />
                    <span>{s.duration_minutes}min</span>
                  </div>
                </div>
              </div>
              <span className="text-accent font-serif text-xl font-bold">€{Number(s.price).toFixed(0)}</span>
            </motion.div>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
};

export default ServicesSection;
