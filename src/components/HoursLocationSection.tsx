import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  return (
    <section id="contact" className="py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">Hours & Location</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="bg-card border border-border rounded-lg p-8">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={20} className="text-primary" />
              <h3 className="font-serif text-xl font-semibold">Opening Hours</h3>
            </div>
            <div className="space-y-3 font-body">
              {displayHours.map((h) => (
                <div key={h.day} className="flex justify-between text-sm">
                  <span className="text-foreground">{h.day}</span>
                  <span className={h.time === "Closed" ? "text-primary" : "text-muted-foreground"}>{h.time}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-card border border-border rounded-lg p-8">
            <div className="flex items-center gap-2 mb-6">
              <MapPin size={20} className="text-primary" />
              <h3 className="font-serif text-xl font-semibold">Find Us</h3>
            </div>
            <p className="text-foreground font-body mb-4">{address}</p>
            <div className="rounded-lg overflow-hidden border border-border">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2400.0!2d-6.9261!3d52.8408!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTLCsDUwJzI3LjIiTiA2wrA1NSczMy41Ilc!5e0!3m2!1sen!2sie!4v1"
                width="100%"
                height="250"
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
