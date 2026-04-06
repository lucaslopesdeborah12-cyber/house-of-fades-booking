import { motion } from "framer-motion";
import { Scissors } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import FadeInStagger from "./FadeInStagger";

const team = [
  { name: "John", role: "Senior Barber" },
  { name: "Mario", role: "Style Specialist" },
  { name: "CJ", role: "Fade Expert" },
];

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const TeamSection = ({ onBookWithBarber }: { onBookWithBarber?: (name: string) => void }) => {
  const { t } = useLanguage();

  return (
    <section id="team" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOutExpo }} className="mb-16 text-center">
          <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">{t("team.label")}</p>
          <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">{t("team.title")}</h2>
        </motion.div>

        <FadeInStagger className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {team.map((member) => (
            <div key={member.name} className="glass-card rounded-[20px] p-8 text-center transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_70px_hsla(43,74%,52%,0.12)]">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                <Scissors size={30} className="text-accent" />
              </div>
              <h3 className="font-serif text-3xl font-semibold text-foreground">{member.name}</h3>
              <p className="mt-2 font-body text-sm text-muted-foreground">{member.role}</p>
              <motion.button
                onClick={() => onBookWithBarber?.(member.name)}
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px hsla(43, 74%, 52%, 0.18)" }}
                whileTap={{ scale: 0.98 }}
                className="btn-gold-outline mt-8 inline-flex rounded px-6 py-3 font-body text-xs font-semibold uppercase tracking-[0.05em]"
              >
                {t("team.bookWith")} {member.name}
              </motion.button>
            </div>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
};

export default TeamSection;
