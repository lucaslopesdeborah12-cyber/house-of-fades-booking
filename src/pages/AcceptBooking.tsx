import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

let emailjsInited = false;

const AcceptBooking = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const { t } = useLanguage();

  useEffect(() => {
    const process = async () => {
      const date = params.get("date");
      const time = params.get("time");
      const barberId = params.get("barber");
      const name = params.get("name");
      const email = params.get("email");
      const phone = params.get("phone");
      const waitingId = params.get("waitingId");

      if (!date || !time || !barberId || !name || !waitingId) {
        setErrorMsg(t("linkPage.invalidLink"));
        setStatus("error");
        return;
      }

      // Check if waiting list entry is still valid
      const { data: entry } = await supabase
        .from("waiting_list")
        .select("*")
        .eq("id", waitingId)
        .single();

      if (!entry || entry.status === "cancelled" || entry.status === "declined" || entry.status === "accepted") {
        setErrorMsg(t("linkPage.linkExpired"));
        setStatus("error");
        return;
      }

      // Check if slot is still available
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("barber_id", barberId)
        .eq("appointment_date", date)
        .eq("time_slot", time)
        .in("status", ["booked", "confirmed"]);

      if (existing && existing.length > 0) {
        setErrorMsg(t("linkPage.slotTakenLong") + " 🙏");
        setStatus("error");
        return;
      }

      // Get a service_id
      let serviceId = barberId; // fallback
      const { data: services } = await supabase.from("services").select("id").limit(1);
      if (services && services.length > 0) {
        serviceId = services[0].id;
      }

      // Book the appointment
      const { error: bookError } = await supabase.from("appointments").insert({
        barber_id: barberId,
        service_id: serviceId,
        appointment_date: date,
        time_slot: time,
        client_name: name,
        client_email: email || null,
        client_phone: phone || null,
      });

      if (bookError) {
        console.error("Booking error:", bookError);
        setErrorMsg(t("linkPage.bookError"));
        setStatus("error");
        return;
      }

      // Update this waiting list entry to accepted
      await supabase.from("waiting_list").update({ status: "accepted" }).eq("id", waitingId);

      // Cancel all other waiting list entries for this slot
      await supabase.from("waiting_list")
        .update({ status: "cancelled" })
        .eq("barber_id", barberId)
        .eq("appointment_date", date)
        .eq("time_slot", entry.time_slot)
        .neq("id", waitingId)
        .in("status", ["pending", "notified"]);

      // Send confirmation email
      if (email) {
        try {
          if (!emailjsInited) {
            emailjs.init("TBNWeHLfrq6OuvZhQ");
            emailjsInited = true;
          }
          // EmailJS Service ID: service_y59db7l
          await emailjs.send("service_y59db7l", "template_7i3p8r9", {
            to_name: name,
            to_email: email,
            date: date,
            time: time,
            service: "Appointment",
            barber: "House of Fades",
            price: "",
          });
          console.log("Confirmation email sent");
        } catch (err) {
          console.error("EmailJS confirmation error:", err);
        }
      }

      // Send confirmation SMS
      if (phone) {
        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              action: "confirmation",
              phone: phone,
              clientName: name,
              barberName: "House of Fades",
              serviceName: "Appointment",
              date: date,
              time: time,
            },
          });
          console.log("Confirmation SMS sent");
        } catch (err) {
          console.error("SMS confirmation error:", err);
        }
      }

      setStatus("success");
      setTimeout(() => navigate("/"), 3000);
    };

    process();
  }, [params, navigate, t]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-accent animate-spin" />
            <p className="text-foreground font-body text-lg">{t("linkPage.processing")}</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">{t("linkPage.bookedTitle")}</h1>
            <p className="text-muted-foreground font-body">{t("linkPage.seeYou")} 🎉</p>
            <p className="text-muted-foreground font-body text-sm">{t("linkPage.redirecting")}</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="font-serif text-2xl text-foreground">{t("linkPage.oops")}</h1>
            <p className="text-muted-foreground font-body">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptBooking;
