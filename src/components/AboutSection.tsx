import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import barberAction from "@/assets/barber-action.jpg";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const AboutSection = () => {
  const [aboutText, setAboutText] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", "about").maybeSingle().then(({ data }) => {
      if (data) {
        const val = data.value as any;
        setAboutText(val?.text || "");
      }
    });
  }, []);

  return (
    <section className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto max-w-6xl">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: easeOutExpo }}
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-card"
          >
            <img
              src={barberAction}
              alt="Barber at work"
              loading="lazy"
              width={800}
              height={800}
              onLoad={() => setImageLoaded(true)}
              className={`aspect-[4/4.6] w-full object-cover transition-all duration-700 ${imageLoaded ? "scale-100 blur-0" : "scale-105 blur-xl"}`}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.12, ease: easeOutExpo }}
          >
            <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">About</p>
            <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">A sharper atmosphere, built around confidence and craft.</h2>
            <p className="mt-6 font-body text-lg leading-relaxed text-foreground/86">
              It's a beautiful thing when a career and a passion come together.
            </p>
            <p className="mt-4 font-body leading-relaxed text-muted-foreground">
              {aboutText || "House has been serving Carlow since 2025."}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
