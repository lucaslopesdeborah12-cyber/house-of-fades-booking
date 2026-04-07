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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { hoursAhead } = await req.json().catch(() => ({ hoursAhead: undefined }));

    // Send SMS reminders by calling send-sms function
    const hoursToCheck = hoursAhead ? [hoursAhead] : [2, 24];
    const results: any[] = [];

    for (const hours of hoursToCheck) {
      // Trigger SMS reminders
      const smsResult = await supabase.functions.invoke("send-sms", {
        body: { action: "send-reminders", hoursAhead: hours },
      });
      results.push({ hours, sms: smsResult.data });

      // Also send email reminders
      const now = new Date();
      const targetTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const targetDate = targetTime.toISOString().split("T")[0];
      const targetHour = targetTime.getHours().toString().padStart(2, "0");
      const targetMinute = targetTime.getMinutes() < 30 ? "00" : "30";
      const targetSlot = `${targetHour}:${targetMinute}`;

      const { data: appointments } = await supabase
        .from("appointments")
        .select("*, barbers(name)")
        .eq("appointment_date", targetDate)
        .eq("time_slot", `${targetSlot}:00`)
        .in("status", ["booked", "confirmed"])
        .not("client_email", "is", null);

      // Email reminders are handled client-side via EmailJS
      // We log which appointments need email reminders
      const emailCount = (appointments || []).filter((apt: any) => {
        const pref = apt.contact_preference || "both";
        return pref === "email" || pref === "both";
      }).length;

      results.push({ hours, emailsPending: emailCount });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-reminders] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
