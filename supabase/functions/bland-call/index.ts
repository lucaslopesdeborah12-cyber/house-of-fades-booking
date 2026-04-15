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
    const BLAND_AI_API_KEY = Deno.env.get("BLAND_AI_API_KEY");
    if (!BLAND_AI_API_KEY) {
      throw new Error("BLAND_AI_API_KEY is not configured");
    }

    const { clientName, serviceName, barberName, date, time } = await req.json();

    if (!clientName || !date || !time) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get owner phone from owner_settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: phoneSetting } = await supabase
      .from("owner_settings")
      .select("value")
      .eq("key", "owner_phone")
      .maybeSingle();

    const ownerPhone = phoneSetting?.value;
    if (!ownerPhone) {
      console.log("[bland-call] No owner_phone configured, skipping call");
      return new Response(JSON.stringify({ skipped: true, reason: "No owner phone configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const task = `You are calling the owner of House of Fades barbershop to notify them of a new booking. Say: A new appointment has been booked. Client name: ${clientName}. Service: ${serviceName || "Appointment"}. Date: ${date}. Time: ${time}. With barber: ${barberName || "House of Fades"}.`;

    const response = await fetch("https://api.bland.ai/v1/calls", {
      method: "POST",
      headers: {
        "Authorization": BLAND_AI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: ownerPhone,
        task,
        voice: "nat",
        first_sentence: "Hello, this is House of Fades booking system with a new appointment notification.",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[bland-call] API error:", JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, error: data }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[bland-call] Call initiated:", JSON.stringify(data));
    return new Response(JSON.stringify({ success: true, data }), {
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
