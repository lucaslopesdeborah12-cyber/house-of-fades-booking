import { motion } from "framer-motion";
import { Scissors } from "lucide-react";

const team = [
  { name: "John", role: "Senior Barber" },
  { name: "Mario", role: "Style Specialist" },
  { name: "CJ", role: "Fade Expert" },
];

const TeamSection = ({ onBookWithBarber }: { onBookWithBarber?: (name: string) => void }) => {
  return (
    <section id="team" className="py-24 px-4">
      <div className="container mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 gold-title-gradient">Meet the Team</h2>
          <p className="text-muted-foreground font-body">Three barbers. One standard of excellence.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card rounded-lg p-8 text-center group hover:shadow-[0_0_30px_hsla(43,52%,54%,0.12)] transition-all duration-300"
            >
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/30 flex items-center justify-center border border-accent/20 group-hover:border-accent/50 transition-colors">
                <Scissors size={32} className="text-accent" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-1">{member.name}</h3>
              <p className="text-muted-foreground font-body text-sm mb-6">{member.role}</p>
              <button
                onClick={() => onBookWithBarber?.(member.name)}
                className="inline-block btn-gold-outline px-6 py-2.5 rounded text-sm font-medium font-body"
              >
                Book with {member.name}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeamSection;
