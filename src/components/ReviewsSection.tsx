import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const placeholderReviews = [
  { author: "Liam K.", text: "Best fade in Carlow, hands down. Always leave looking sharp.", rating: 5 },
  { author: "Darren O.", text: "Brilliant barbers, great atmosphere. Wouldn't go anywhere else.", rating: 5 },
];

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const ReviewsSection = () => {
  const [reviews, setReviews] = useState<{ author: string; text: string; rating: number }[]>([]);
  const [idx, setIdx] = useState(0);

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
    <section id="reviews" className="py-20 md:py-[120px] px-4">
      <div className="container mx-auto max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: easeOutExpo }}
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-12 gold-title-gradient">What Our Clients Say</h2>
        </motion.div>

        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4, ease: easeOutExpo }}
              className="glass-card rounded-lg p-8 md:p-12"
            >
              <div className="flex justify-center gap-1 mb-6">
                {[...Array(reviews[idx].rating)].map((_, i) => (
                  <Star key={i} size={20} className="fill-accent text-accent" />
                ))}
              </div>
              <p className="text-foreground/90 font-body text-lg italic mb-6 leading-relaxed">
                "{reviews[idx].text}"
              </p>
              <p className="text-muted-foreground font-body font-medium">
                — {reviews[idx].author}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-4 mt-6">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={prev} className="p-2 rounded-full border border-white/[0.1] hover:border-accent/50 hover:shadow-[0_0_15px_hsla(43,74%,52%,0.15)] transition-all duration-300 text-foreground">
              <ChevronLeft size={20} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={next} className="p-2 rounded-full border border-white/[0.1] hover:border-accent/50 hover:shadow-[0_0_15px_hsla(43,74%,52%,0.15)] transition-all duration-300 text-foreground">
              <ChevronRight size={20} />
            </motion.button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
