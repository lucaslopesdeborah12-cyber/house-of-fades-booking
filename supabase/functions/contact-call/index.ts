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

    const { clientName, clientPhone, task } = await req.json();

    if (!clientPhone || !task) {
      return new Response(JSON.stringify({ error: "Missing clientPhone or task" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.bland.ai/v1/calls", {
      method: "POST",
      headers: {
        "Authorization": BLAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: clientPhone,
        task,
        voice: "nat",
        language: "pt",
        first_sentence: `Olá${clientName ? " " + clientName : ""}, estou a ligar da House of Fades em Carlow...`,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[contact-call] Bland error:", JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, error: data }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[contact-call] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});