import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import FadeInStagger from "./FadeInStagger";

type Service = { id: string; name: string; duration_minutes: number; price: number };
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const ServicesSection = ({ onBookNow }: { onBookNow?: () => void }) => {
  const [services, setServices] = useState<Service[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    supabase.from("services").select("id, name, duration_minutes, price").order("created_at").then(({ data }) => {
      if (data) setServices(data);
    });
  }, []);

  return (
    <section id="services" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: easeOutExpo }}
          className="mb-20"
        >
          <p className="mb-4 font-sans text-[10px] font-light uppercase tracking-[0.45em] text-[#c9a84c]/50">{t("services.label")}</p>
          <h2 className="font-serif text-4xl font-bold italic md:text-5xl" style={{ color: '#c9a84c' }}>{t("services.title")}</h2>
        </motion.div>

        <FadeInStagger className="flex flex-col">
          {services.map((s, index) => (
            <motion.div
              key={s.id}
              onClick={onBookNow}
              whileHover={{ x: 8 }}
              transition={{ duration: 0.25 }}
              className="cursor-pointer group"
              style={{
                borderBottom: index < services.length - 1 ? '0.5px solid rgba(201,168,76,0.12)' : 'none',
              }}
            >
              <div className="flex items-baseline justify-between py-8 md:py-10">
                <div className="flex items-baseline gap-6">
                  <span className="font-sans text-[11px] font-light tracking-[0.15em] text-[#c9a84c]/30">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-foreground group-hover:text-[#c9a84c] transition-colors duration-300 md:text-2xl">
                      {s.name}
                    </h3>
                    <span className="font-sans text-[10px] font-light tracking-[0.2em] text-foreground/25 uppercase mt-1 block">
                      {s.duration_minutes} {t("services.min")}
                    </span>
                  </div>
                </div>
                <span className="font-cormorant text-2xl italic text-[#c9a84c] md:text-3xl">
                  €{Number(s.price).toFixed(0)}
                </span>
              </div>
            </motion.div>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
};

export default ServicesSection;
