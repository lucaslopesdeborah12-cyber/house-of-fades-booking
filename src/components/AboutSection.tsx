import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import barberAction from "@/assets/barber-action.jpg";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const AboutSection = () => {
  const [aboutText, setAboutText] = useState("");

  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", "about").maybeSingle().then(({ data }) => {
      if (data) {
        const val = data.value as any;
        setAboutText(val?.text || "");
      }
    });
  }, []);

  return (
    <section className="py-20 md:py-[120px] px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="grid md:grid-cols-2 gap-0 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: easeOutExpo }}
          >
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={barberAction}
                alt="Barber at work"
                className="w-full object-cover aspect-square"
                loading="lazy"
                width={800}
                height={800}
              />
            </div>
          </motion.div>

          <div className="hidden md:flex items-stretch relative">
            <div className="absolute left-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-accent to-transparent opacity-40" />
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.15, ease: easeOutExpo }}
              className="pl-12"
            >
              <h2 className="font-serif text-4xl md:text-5xl font-bold mb-6 gold-title-gradient">About Us</h2>
              <p className="text-foreground/90 font-body leading-relaxed mb-4">
                It's a beautiful thing when a career and a passion come together.
              </p>
              <p className="text-muted-foreground font-body leading-relaxed">
                {aboutText || "House has been serving Carlow since 2025."}
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: easeOutExpo }}
            className="md:hidden mt-8"
          >
            <h2 className="font-serif text-4xl font-bold mb-6 gold-title-gradient">About Us</h2>
            <p className="text-foreground/90 font-body leading-relaxed mb-4">
              It's a beautiful thing when a career and a passion come together.
            </p>
            <p className="text-muted-foreground font-body leading-relaxed">
              {aboutText || "House has been serving Carlow since 2025."}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
