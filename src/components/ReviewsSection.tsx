import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const reviews = [
  {
    text: "Would highly recommend the lads. They have great patience with my young lad.",
    author: "Sean M.",
  },
  {
    text: "Best barbershop in Carlow by a mile. Always leave looking sharp.",
    author: "Darren K.",
  },
  {
    text: "Unreal skin fade every single time. The lads know their craft inside out.",
    author: "Conor O'B.",
  },
  {
    text: "Brilliant atmosphere and top-class service. Wouldn't go anywhere else.",
    author: "James P.",
  },
];

const ReviewsSection = () => {
  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => (i === 0 ? reviews.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === reviews.length - 1 ? 0 : i + 1));

  return (
    <section id="reviews" className="py-20 px-4">
      <div className="container mx-auto max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-12">What Our Clients Say</h2>
        </motion.div>

        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="bg-card border border-border rounded-lg p-8 md:p-12"
            >
              <div className="flex justify-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={20} className="fill-primary text-primary" />
                ))}
              </div>
              <p className="text-foreground font-body text-lg italic mb-6 leading-relaxed">
                "{reviews[idx].text}"
              </p>
              <p className="text-muted-foreground font-body font-medium">
                — {reviews[idx].author}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={prev}
              className="p-2 rounded-full border border-border hover:border-primary transition-colors text-foreground"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={next}
              className="p-2 rounded-full border border-border hover:border-primary transition-colors text-foreground"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
