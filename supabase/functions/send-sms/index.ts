import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_FROM = "+16624304415";

async function sendSMS(to: string, body: string): Promise<{ ok: boolean; data: any }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;

  if (!accountSid) throw new Error("TWILIO_ACCOUNT_SID is not configured");
  if (!authToken) throw new Error("TWILIO_AUTH_TOKEN is not configured");

  console.log("[send-sms] Sending SMS to:", to);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("[send-sms] Twilio error:", JSON.stringify(data));
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

      const { hoursAhead } = payload;
      const hours = hoursAhead || 2;

      const now = new Date();
      const targetTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const targetDate = targetTime.toISOString().split("T")[0];
      const targetHour = targetTime.getHours().toString().padStart(2, "0");
      const targetMinute = targetTime.getMinutes() < 30 ? "00" : "30";
      const targetSlot = `${targetHour}:${targetMinute}`;

      console.log(`[send-sms] Sending ${hours}h reminders for date: ${targetDate}, slot: ${targetSlot}`);

      const { data: appointments, error } = await supabase
        .from("appointments")
        .select("*, barbers(name), services(name)")
        .eq("appointment_date", targetDate)
        .eq("time_slot", `${targetSlot}:00`)
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
        const pref = (apt as any).contact_preference || "both";
        const barberName = (apt as any).barbers?.name || "seu barbeiro";
        const serviceName = (apt as any).services?.name || "seu serviço";

        if (apt.client_phone && (pref === "sms" || pref === "both")) {
          const isDay = hours === 24;
          const body = isDay
            ? `⏰ House of Fades Reminder!\n\nHi ${apt.client_name}, your appointment is TOMORROW!\n\n💈 ${barberName}\n✂️ ${serviceName}\n🕐 ${targetSlot}\n\nSee you soon! 🔥`
            : `⏰ House of Fades Reminder!\n\nHi ${apt.client_name}, your appointment is in 2 hours!\n\n💈 ${barberName}\n✂️ ${serviceName}\n🕐 ${targetSlot}\n\nSee you soon! 🔥`;

          try {
            const result = await sendSMS(apt.client_phone, body);
            if (result.ok) sent++;
          } catch (e) {
            console.error("[send-sms] Reminder error:", e);
          }
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
