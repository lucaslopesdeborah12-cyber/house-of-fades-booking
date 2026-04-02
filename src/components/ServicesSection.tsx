import { motion } from "framer-motion";
import { Clock } from "lucide-react";

const services = [
  { name: "Haircut", duration: "20min", price: "€22" },
  { name: "Skin Fade", duration: "20min", price: "€24" },
  { name: "Hot Towel Shave", duration: "20min", price: "€25" },
  { name: "Beard Trim", duration: "20min", price: "€12" },
  { name: "Haircut & Beard Trim", duration: "20min", price: "€29" },
  { name: "Skin Fade & Beard Trim", duration: "20min", price: "€32" },
  { name: "Haircut & Hot Towel Shave", duration: "40min", price: "€40" },
  { name: "Kids Cut Under 12", duration: "20min", price: "€20" },
  { name: "Student Skin Fade", duration: "20min", price: "€20" },
  { name: "OAP Special", duration: "20min", price: "€15" },
];

const ServicesSection = () => {
  return (
    <section id="services" className="py-20 px-4">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">Our Services</h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto">
            Expert grooming tailored to your style
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-card border border-border rounded-lg p-6 flex items-center justify-between hover:border-primary/50 transition-colors"
            >
              <div>
                <h3 className="font-serif text-lg font-semibold">{s.name}</h3>
                <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1 font-body">
                  <Clock size={14} />
                  <span>{s.duration}</span>
                </div>
              </div>
              <span className="text-primary font-serif text-xl font-bold">{s.price}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
