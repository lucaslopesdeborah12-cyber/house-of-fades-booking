import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Service = { id: string; name: string; duration_minutes: number; price: number };

const ServicesSection = () => {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    supabase.from("services").select("id, name, duration_minutes, price").order("created_at").then(({ data }) => {
      if (data) setServices(data);
    });
  }, []);

  return (
    <section id="services" className="py-24 px-4">
      <div className="container mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">Our Services</h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto">Expert grooming tailored to your style</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="glass-card rounded-lg p-6 flex items-center justify-between hover:-translate-y-1 hover:shadow-[0_0_25px_hsla(43,52%,54%,0.15)] transition-all duration-300 cursor-default group"
            >
              <div className="flex items-center gap-4">
                <Scissors size={18} className="text-accent opacity-50 group-hover:opacity-100 transition-opacity" />
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
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
