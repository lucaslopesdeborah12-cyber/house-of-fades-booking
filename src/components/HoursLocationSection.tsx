import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const HoursLocationSection = () => {
  const [hours, setHours] = useState<{ day: string; time: string }[]>([]);
  const [contact, setContact] = useState<{ address: string; phone: string; email: string }>({ address: "", phone: "", email: "" });

  useEffect(() => {
    supabase.from("site_content").select("key, value").in("key", ["hours", "contact"]).then(({ data }) => {
      data?.forEach((row) => {
        if (row.key === "hours") setHours(row.value as any);
        if (row.key === "contact") setContact(row.value as any);
      });
    });
  }, []);

  const defaultHours = [
    { day: "Monday", time: "Closed" },
    { day: "Tuesday", time: "09:00 – 18:00" },
    { day: "Wednesday", time: "09:00 – 18:00" },
    { day: "Thursday", time: "09:00 – 17:00" },
    { day: "Friday", time: "09:00 – 18:00" },
    { day: "Saturday", time: "09:00 – 17:00" },
    { day: "Sunday", time: "Closed" },
  ];

  const displayHours = hours.length > 0 ? hours : defaultHours;
  const address = contact.address || "153 Green Ln, Carlow, R93 W354";
  const today = dayNames[new Date().getDay()];
  const todayEntry = displayHours.find((h) => h.day === today);
  const isOpen = todayEntry && todayEntry.time !== "Closed";

  return (
    <section id="contact" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOutExpo }} className="mb-14 max-w-2xl">
          <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">Contact</p>
          <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">Visit the shop and plan your next appointment with ease.</h2>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: easeOutExpo }} className="glass-card rounded-[24px] p-8">
            <div className="mb-6 flex items-center gap-3">
              <Clock size={20} className="text-accent" />
              <h3 className="font-serif text-2xl font-semibold">Opening Hours</h3>
            </div>
            <div className="mb-6 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? "bg-green-500" : "bg-red-500"}`} />
              <span className="font-body text-sm text-muted-foreground">{isOpen ? "Open today" : "Closed today"}</span>
            </div>
            <div className="space-y-3 font-body">
              {displayHours.map((h) => {
                const isCurrent = h.day === today;
                return (
                  <div key={h.day} className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm ${isCurrent ? "border border-accent/20 bg-accent/10" : "border border-white/[0.04] bg-white/[0.01]"}`}>
                    <span className={isCurrent ? "font-medium text-accent" : "text-foreground"}>{h.day}</span>
                    <span className={h.time === "Closed" ? "text-primary" : "text-muted-foreground"}>{h.time}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1, ease: easeOutExpo }} className="glass-card rounded-[24px] p-8">
            <div className="mb-6 flex items-center gap-3">
              <MapPin size={20} className="text-accent" />
              <h3 className="font-serif text-2xl font-semibold">Find Us</h3>
            </div>
            <p className="mb-4 font-body text-foreground/86">{address}</p>
            <div className="overflow-hidden rounded-[18px] border border-white/10">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2400.0!2d-6.9261!3d52.8408!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTLCsDUwJzI3LjIiTiA2wrA1NSczMy41Ilc!5e0!3m2!1sen!2sie!4v1"
                width="100%"
                height="280"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="House location"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HoursLocationSection;
