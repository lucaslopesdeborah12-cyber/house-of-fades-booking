import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendSMS(to: string, text: string): Promise<{ ok: boolean; data: any }> {
  const apiKey = Deno.env.get("VONAGE_API_KEY")!;
  const apiSecret = Deno.env.get("VONAGE_API_SECRET")!;

  if (!apiKey) throw new Error("VONAGE_API_KEY is not configured");
  if (!apiSecret) throw new Error("VONAGE_API_SECRET is not configured");

  console.log("[send-sms] Sending SMS to:", to);

  const response = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      api_secret: apiSecret,
      to: to.replace("+", ""),
      from: "HouseOfFades",
      text,
    }),
  });

  const data = await response.json();
  const success = data?.messages?.[0]?.status === "0";
  if (!success) {
    console.error("[send-sms] Vonage error:", JSON.stringify(data));
  } else {
    console.log("[send-sms] SMS sent successfully, message-id:", data?.messages?.[0]?.["message-id"]);
  }
  return { ok: success, data };
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

      const body = `Hi ${clientName}! Your appointment at House of Fades with ${barberName} for ${serviceName} on ${date} at ${time} is confirmed! See you soon! ✂️`;
      const result = await sendSMS(phone, body);

      return new Response(JSON.stringify({ success: result.ok, data: result.data }), {
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

      return new Response(JSON.stringify({ success: result.ok, data: result.data }), {
        status: result.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "custom") {
      const { phone, message } = payload;
      if (!phone || !message) {
        return new Response(JSON.stringify({ error: "Missing phone or message" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await sendSMS(phone, message);
      return new Response(JSON.stringify({ success: result.ok, data: result.data }), {
        status: result.ok ? 200 : 400,
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
        const barberName = (apt as any).barbers?.name || "your barber";
        const serviceName = (apt as any).services?.name || "your service";

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
