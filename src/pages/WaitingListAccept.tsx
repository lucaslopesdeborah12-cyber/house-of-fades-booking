import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const WaitingListAccept = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const { t } = useLanguage();

  useEffect(() => {
    const processAccept = async () => {
      const id = params.get("id");
      const date = params.get("date");
      const time = params.get("time");
      const barberId = params.get("barber_id");
      const serviceId = params.get("service_id");
      const name = params.get("name");
      const email = params.get("email");
      const phone = params.get("phone");

      if (!id || !date || !time || !barberId || !name) {
        setErrorMsg(t("linkPage.invalidLink"));
        setStatus("error");
        return;
      }

      // Check if waiting list entry still exists and is valid
      const { data: entry } = await supabase
        .from("waiting_list")
        .select("*")
        .eq("id", id)
        .single();

      if (!entry || entry.status === "cancelled" || entry.status === "declined" || entry.status === "accepted") {
        setErrorMsg(t("linkPage.linkExpired"));
        setStatus("error");
        return;
      }

      // Check if the slot is still available
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("barber_id", barberId)
        .eq("appointment_date", date)
        .eq("time_slot", time)
        .in("status", ["booked", "confirmed"]);

      if (existing && existing.length > 0) {
        setErrorMsg(t("linkPage.slotTaken"));
        setStatus("error");
        // Update waiting list status
        await supabase.from("waiting_list").update({ status: "cancelled" }).eq("id", id);
        return;
      }

      // Book the appointment
      const { error: bookError } = await supabase.from("appointments").insert({
        barber_id: barberId,
        service_id: serviceId || barberId, // fallback
        appointment_date: date,
        time_slot: time,
        client_name: name,
        client_email: email || null,
        client_phone: phone || null,
      });

      if (bookError) {
        console.error(bookError);
        setErrorMsg(t("linkPage.bookError"));
        setStatus("error");
        return;
      }

      // Update waiting list status
      await supabase.from("waiting_list").update({ status: "accepted" }).eq("id", id);

      setStatus("success");

      // Redirect after 3 seconds
      setTimeout(() => navigate("/"), 3000);
    };

    processAccept();
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

export default WaitingListAccept;
