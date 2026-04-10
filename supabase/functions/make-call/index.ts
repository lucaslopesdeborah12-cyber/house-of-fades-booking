const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");

    const { action, phone, clientName, barberName, serviceName, date, time } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ success: false, error: "No phone number provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let message = "";
    if (action === "confirmation") {
      message = `Hello ${clientName}! This is House of Fades confirming your appointment with ${barberName} for ${serviceName} on ${date} at ${time}. We look forward to seeing you! Goodbye!`;
    } else if (action === "reminder") {
      message = `Hello ${clientName}! This is a reminder from House of Fades. Your appointment with ${barberName} for ${serviceName} is today at ${time}. See you soon! Goodbye!`;
    } else {
      return new Response(JSON.stringify({ success: false, error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-GB">${message}</Say><Pause length="1"/><Say voice="alice" language="en-GB">${message}</Say></Response>`;

    console.log("[make-call] Calling:", phone, "Action:", action);

    const response = await fetch(`${GATEWAY_URL}/Calls.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_PHONE_NUMBER,
        Twiml: twiml,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[make-call] Twilio error:", JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, error: data }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[make-call] Call initiated, SID:", data.sid);
    return new Response(JSON.stringify({ success: true, sid: data.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[make-call] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
