import { motion } from "framer-motion";
import barberAction from "@/assets/barber-action.jpg";

const AboutSection = () => {
  return (
    <section className="py-20 px-4 bg-secondary">
      <div className="container mx-auto max-w-5xl">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img
              src={barberAction}
              alt="Barber at work"
              className="rounded-lg w-full object-cover aspect-square"
              loading="lazy"
              width={800}
              height={800}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl font-bold mb-6">About Us</h2>
            <p className="text-foreground font-body leading-relaxed mb-4">
              It's a beautiful thing when a career and a passion come together.
            </p>
            <p className="text-muted-foreground font-body leading-relaxed">
              House of Fades has been serving Carlow since 2025. We believe every
              man deserves to look and feel his best. Our team of skilled barbers
              brings precision, style, and a genuine love for the craft to every
              appointment.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
