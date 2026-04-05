import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_FROM = "+16624304415";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    if (!TWILIO_ACCOUNT_SID) throw new Error("TWILIO_ACCOUNT_SID is not configured");

    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!TWILIO_AUTH_TOKEN) throw new Error("TWILIO_AUTH_TOKEN is not configured");

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const { action, ...payload } = await req.json();

    if (action === "confirmation") {
      const { phone, clientName, barberName, serviceName, date, time } = payload;
      if (!phone) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "No phone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = `Olá ${clientName}! Seu agendamento na House of Fades está confirmado para ${date} às ${time}. Até lá! ✂️`;

      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: body }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Twilio error:", data);
        return new Response(JSON.stringify({ success: false, error: data }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, sid: data.sid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send-reminders") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const targetDate = twoHoursLater.toISOString().split("T")[0];
      const targetHour = twoHoursLater.getHours().toString().padStart(2, "0");
      const targetMinute = twoHoursLater.getMinutes() < 30 ? "00" : "30";
      const targetTime = `${targetHour}:${targetMinute}`;

      const { data: appointments, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name)")
        .eq("appointment_date", targetDate)
        .eq("time_slot", `${targetTime}:00`)
        .in("status", ["booked", "confirmed"])
        .not("client_phone", "is", null);

      if (error) {
        console.error("Query error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let sent = 0;
      for (const apt of appointments || []) {
        if (!apt.client_phone) continue;

        const barberName = (apt as any).barbers?.name || "seu barbeiro";
        const serviceName = (apt as any).services?.name || "seu serviço";

        const body = `⏰ Lembrete House of Fades!\n\nOlá ${apt.client_name}, seu horário é em 2 horas!\n\n💈 ${barberName}\n✂️ ${serviceName}\n🕐 ${targetTime}\n\nTe esperamos! 🔥`;

        try {
          const response = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: apt.client_phone, From: TWILIO_FROM, Body: body }),
          });
          if (response.ok) sent++;
          else console.error("Failed to send reminder to", apt.client_phone);
        } catch (e) {
          console.error("SMS error:", e);
        }
      }

      return new Response(JSON.stringify({ success: true, sent, total: appointments?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
