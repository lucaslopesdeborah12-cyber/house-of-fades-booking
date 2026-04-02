import { motion } from "framer-motion";
import { Scissors } from "lucide-react";

const team = [
  { name: "John", role: "Senior Barber" },
  { name: "Mario", role: "Style Specialist" },
  { name: "CJ", role: "Fade Expert" },
];

const TeamSection = () => {
  return (
    <section id="team" className="py-20 px-4 bg-secondary">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">Meet the Team</h2>
          <p className="text-muted-foreground font-body">
            Three barbers. One standard of excellence.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-card border border-border rounded-lg p-8 text-center"
            >
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <Scissors size={32} className="text-primary" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-1">{member.name}</h3>
              <p className="text-muted-foreground font-body text-sm mb-6">{member.role}</p>
              <a
                href="#services"
                className="inline-block bg-accent text-accent-foreground px-6 py-2.5 rounded text-sm font-medium hover:bg-accent/80 transition-colors font-body"
              >
                Book with {member.name}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeamSection;
