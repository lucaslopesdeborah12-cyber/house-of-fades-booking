import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const BLAND_API_KEY = Deno.env.get("BLAND_AI_API_KEY");
    if (!BLAND_API_KEY) {
      throw new Error("BLAND_AI_API_KEY is not configured");
    }

    const { clientName, clientPhone, serviceName, barberName, date, time, appointmentDate } = await req.json();

    if (!clientName || !clientPhone || !date || !time) {
      return new Response(JSON.stringify({ error: "Missing required fields (clientName, clientPhone, date, time)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      "Authorization": BLAND_API_KEY,
      "Content-Type": "application/json",
    };

    // Call 1: Immediate confirmation call to client
    const confirmationTask = `You are calling a client of House of Fades barbershop in Carlow, Ireland to confirm their appointment. Say exactly: Hello ${clientName}, this is House of Fades barbershop in Carlow, Ireland. Your appointment has been confirmed for ${date} at ${time} with ${barberName || "our barber"} for ${serviceName || "your appointment"}. We look forward to seeing you. Thank you!`;

    const call1Response = await fetch("https://api.bland.ai/v1/calls", {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone_number: clientPhone,
        task: confirmationTask,
        voice: "nat",
        first_sentence: `Hello ${clientName}, this is House of Fades barbershop in Carlow, Ireland with your appointment confirmation.`,
      }),
    });

    const call1Data = await call1Response.json();
    if (!call1Response.ok) {
      console.error("[bland-call] Confirmation call error:", JSON.stringify(call1Data));
    } else {
      console.log("[bland-call] Confirmation call initiated:", JSON.stringify(call1Data));
    }

    // Call 2: Scheduled reminder 2 hours before appointment
    // appointmentDate is "YYYY-MM-DD", time is "HH:MM"
    const isoDate = appointmentDate || date.split("/").reverse().join("-");
    const appointmentDateTime = new Date(`${isoDate}T${time}:00`);
    const reminderTime = new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000);
    const now = new Date();

    let call2Data: any = null;
    if (reminderTime > now) {
      const scheduledTimeISO = reminderTime.toISOString();

      const reminderTask = `You are calling a client of House of Fades barbershop to remind them of their appointment. Say exactly: Hello ${clientName}, this is a reminder from House of Fades barbershop. Your appointment is in 2 hours, today at ${time} with ${barberName || "our barber"} for ${serviceName || "your appointment"}. See you soon!`;

      const call2Response = await fetch("https://api.bland.ai/v1/calls", {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone_number: clientPhone,
          task: reminderTask,
          voice: "nat",
          first_sentence: `Hello ${clientName}, this is a reminder from House of Fades barbershop.`,
          scheduled_time: scheduledTimeISO,
        }),
      });

      call2Data = await call2Response.json();
      if (!call2Response.ok) {
        console.error("[bland-call] Reminder call error:", JSON.stringify(call2Data));
      } else {
        console.log("[bland-call] Reminder call scheduled for", scheduledTimeISO, ":", JSON.stringify(call2Data));
      }
    } else {
      console.log("[bland-call] Skipping reminder — appointment is less than 2 hours away");
    }

    return new Response(JSON.stringify({ success: true, confirmation: call1Data, reminder: call2Data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[bland-call] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
