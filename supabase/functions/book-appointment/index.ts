import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_EMAIL = 5;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { barber_id, service_id, appointment_date, time_slot, client_name, client_phone, client_email, contact_preference } = body;

    // Input validation
    if (!barber_id || typeof barber_id !== "string" || barber_id.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid barber" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!service_id || typeof service_id !== "string" || service_id.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid service" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!appointment_date || !/^\d{4}-\d{2}-\d{2}$/.test(appointment_date)) {
      return new Response(JSON.stringify({ error: "Invalid date" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!time_slot || !/^\d{2}:\d{2}$/.test(time_slot)) {
      return new Response(JSON.stringify({ error: "Invalid time" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!client_name || typeof client_name !== "string" || client_name.trim().length === 0 || client_name.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid name" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (client_email && (typeof client_email !== "string" || client_email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email))) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (client_phone && (typeof client_phone !== "string" || client_phone.length > 30)) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check date is not in the past
    const today = new Date().toISOString().slice(0, 10);
    if (appointment_date < today) {
      return new Response(JSON.stringify({ error: "Cannot book in the past" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: ipCount } = await supabase
      .from("booking_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", clientIp)
      .gte("created_at", oneHourAgo);

    if ((ipCount ?? 0) >= MAX_ATTEMPTS_PER_IP) {
      return new Response(JSON.stringify({ error: "Too many booking attempts. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (client_email) {
      const { count: emailCount } = await supabase
        .from("booking_attempts")
        .select("*", { count: "exact", head: true })
        .eq("client_email", client_email)
        .gte("created_at", oneHourAgo);

      if ((emailCount ?? 0) >= MAX_ATTEMPTS_PER_EMAIL) {
        return new Response(JSON.stringify({ error: "Too many booking attempts for this email. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await supabase.from("booking_attempts").insert({
      ip_address: clientIp,
      client_email: client_email || null,
    });

    // Verify barber and service exist
    const [{ data: barber }, { data: service }] = await Promise.all([
      supabase.from("barbers").select("id").eq("id", barber_id).maybeSingle(),
      supabase.from("services").select("id").eq("id", service_id).maybeSingle(),
    ]);

    if (!barber) {
      return new Response(JSON.stringify({ error: "Barber not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!service) {
      return new Response(JSON.stringify({ error: "Service not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use a transactional lock to prevent race conditions
    const { data: txResult, error: txError } = await supabase.rpc("book_appointment_tx", {
      p_barber_id: barber_id,
      p_service_id: service_id,
      p_appointment_date: appointment_date,
      p_time_slot: time_slot,
      p_client_name: client_name.trim(),
      p_client_phone: client_phone || null,
      p_client_email: client_email || null,
      p_contact_preference: contact_preference || "sms",
    });

    if (txError) {
      console.error("Transaction error:", txError);
      // Check if it's our custom slot-taken error
      if (txError.message?.includes("slot_taken")) {
        return new Response(JSON.stringify({ 
          error: "Este horário acabou de ser reservado. Por favor escolha outro horário.",
          slot_taken: true,
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to book appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cleanup old attempts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("booking_attempts").delete().lt("created_at", oneDayAgo);

    return new Response(JSON.stringify({ success: true, id: txResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Booking error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
