import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const placeholderReviews = [
  { author: "Liam K.", text: "Best fade in Carlow, hands down. Always leave looking sharp.", rating: 5 },
  { author: "Darren O.", text: "Brilliant barbers, great atmosphere. Wouldn't go anywhere else.", rating: 5 },
];

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const ReviewsSection = () => {
  const [reviews, setReviews] = useState<{ author: string; text: string; rating: number }[]>([]);
  const [idx, setIdx] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    supabase.from("reviews").select("author, text, rating").order("created_at").then(({ data }) => {
      const combined = [...(data || []), ...placeholderReviews];
      setReviews(combined);
    });
  }, []);

  const prev = () => setIdx((i) => (i === 0 ? reviews.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === reviews.length - 1 ? 0 : i + 1));

  if (reviews.length === 0) return null;

  return (
    <section id="reviews" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOutExpo }} className="mb-12">
          <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">{t("reviews.label")}</p>
          <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">{t("reviews.title")}</h2>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: easeOutExpo }}
            className="glass-card rounded-[24px] px-8 py-10 md:px-12 md:py-14"
          >
            <div className="mb-6 flex justify-center gap-1">
              {[...Array(reviews[idx].rating)].map((_, i) => (
                <Star key={i} size={20} className="fill-accent text-accent" />
              ))}
            </div>
            <p className="font-serif text-2xl leading-relaxed text-foreground md:text-3xl">"{reviews[idx].text}"</p>
            <p className="mt-6 font-body text-sm uppercase tracking-[0.2em] text-muted-foreground">{reviews[idx].author}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex justify-center gap-4">
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }} onClick={prev} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-foreground transition-all duration-300 hover:border-accent/40 hover:text-accent">
            <ChevronLeft size={20} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }} onClick={next} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-foreground transition-all duration-300 hover:border-accent/40 hover:text-accent">
            <ChevronRight size={20} />
          </motion.button>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
