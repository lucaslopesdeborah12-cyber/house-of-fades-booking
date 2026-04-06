import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_FROM = "+16624304415";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

async function sendSMS(to: string, body: string): Promise<{ ok: boolean; data: any }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

  console.log("[send-sms] Sending SMS to:", to);

  const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("[send-sms] Twilio gateway error:", JSON.stringify(data));
  } else {
    console.log("[send-sms] SMS sent successfully, SID:", data.sid);
  }
  return { ok: response.ok, data };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();
    console.log("[send-sms] Action:", action);

    if (action === "confirmation") {
      const { phone, clientName, barberName, serviceName, date, time } = payload;
      if (!phone) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "No phone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = `Olá ${clientName}! Seu agendamento na House of Fades está confirmado para ${date} às ${time}. Até lá! ✂️`;
      const result = await sendSMS(phone, body);

      return new Response(JSON.stringify({ success: result.ok, sid: result.data.sid }), {
        status: result.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "waiting-list-notify") {
      const { phone, message } = payload;
      if (!phone) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await sendSMS(phone, message);

      return new Response(JSON.stringify({ success: result.ok, sid: result.data.sid }), {
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
        console.error("[send-sms] Query error:", error);
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
          const result = await sendSMS(apt.client_phone, body);
          if (result.ok) sent++;
        } catch (e) {
          console.error("[send-sms] Reminder error:", e);
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
    console.error("[send-sms] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
