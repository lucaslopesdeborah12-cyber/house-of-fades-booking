import { motion } from "framer-motion";
import { Scissors } from "lucide-react";
import FadeInStagger from "./FadeInStagger";

const team = [
  { name: "John", role: "Senior Barber" },
  { name: "Mario", role: "Style Specialist" },
  { name: "CJ", role: "Fade Expert" },
];

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const TeamSection = ({ onBookWithBarber }: { onBookWithBarber?: (name: string) => void }) => {
  return (
    <section id="team" className="py-20 md:py-[120px] px-4">
      <div className="container mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOutExpo }} className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 gold-title-gradient">Meet the Team</h2>
          <p className="text-muted-foreground font-body">Three barbers. One standard of excellence.</p>
        </motion.div>

        <FadeInStagger className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {team.map((member) => (
            <div
              key={member.name}
              className="glass-card rounded-lg p-8 text-center group hover:shadow-[0_0_30px_hsla(43,74%,52%,0.1)] transition-all duration-500"
            >
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/20 flex items-center justify-center border border-white/[0.08] group-hover:border-accent/40 transition-colors duration-500">
                <Scissors size={32} className="text-accent opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-1">{member.name}</h3>
              <p className="text-muted-foreground font-body text-sm mb-6">{member.role}</p>
              <motion.button
                onClick={() => onBookWithBarber?.(member.name)}
                whileHover={{ scale: 1.05, boxShadow: "0 0 25px hsla(43, 74%, 52%, 0.25)" }}
                whileTap={{ scale: 0.97 }}
                className="inline-block btn-gold-outline px-6 py-2.5 rounded text-sm font-medium font-body tracking-[0.05em]"
              >
                Book with {member.name}
              </motion.button>
            </div>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
};

export default TeamSection;
