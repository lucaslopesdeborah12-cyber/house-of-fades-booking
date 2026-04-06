import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";

// Initialize EmailJS
let emailjsInitialized = false;
const ensureEmailJSInit = () => {
  if (!emailjsInitialized) {
    emailjs.init("TBNWeHLfrq6OuvZhQ");
    emailjsInitialized = true;
    console.log("[WaitingListNotifier] EmailJS initialized");
  }
};

export const notifyWaitingList = async (
  barberId: string,
  date: string,
  cancelledTime: string,
  barberName?: string
) => {
  ensureEmailJSInit();
  console.log("[WaitingListNotifier] Starting notification for barber:", barberId, "date:", date, "time:", cancelledTime);

  const { data: waiters, error: fetchError } = await supabase
    .from("waiting_list")
    .select("*")
    .eq("barber_id", barberId)
    .eq("appointment_date", date)
    .in("status", ["pending"]);

  if (fetchError) {
    console.error("[WaitingListNotifier] Error fetching waiters:", fetchError);
    return;
  }

  console.log("[WaitingListNotifier] Found waiters:", waiters?.length || 0);
  if (!waiters || waiters.length === 0) return;

  const baseUrl = window.location.origin;

  for (const waiter of waiters) {
    console.log("[WaitingListNotifier] Notifying waiter:", waiter.client_name, waiter.client_email);

    const acceptLink = `${baseUrl}/waiting-list/accept?id=${waiter.id}&date=${date}&time=${cancelledTime}&barber_id=${barberId}&name=${encodeURIComponent(waiter.client_name)}&email=${encodeURIComponent(waiter.client_email || "")}&phone=${encodeURIComponent(waiter.client_phone || "")}`;
    const declineLink = `${baseUrl}/waiting-list/decline?id=${waiter.id}`;

    // Update status to notified
    const { error: updateError } = await supabase.from("waiting_list").update({
      status: "notified",
      notified_at: new Date().toISOString()
    }).eq("id", waiter.id);

    if (updateError) {
      console.error("[WaitingListNotifier] Error updating status:", updateError);
    } else {
      console.log("[WaitingListNotifier] Status updated to notified for:", waiter.id);
    }

    // Send email via EmailJS
    console.log("[WaitingListNotifier] Sending EmailJS notification to:", waiter.client_email);
    try {
      const emailResult = await emailjs.send(
        "service_jq26o2f",
        "template_9wigrr6",
        {
          to_name: waiter.client_name,
          to_email: waiter.client_email,
          date: date,
          time: cancelledTime,
          accept_link: acceptLink,
          decline_link: declineLink,
        }
      );
      console.log("[WaitingListNotifier] EmailJS sent successfully:", emailResult.status, emailResult.text);
    } catch (emailErr) {
      console.error("[WaitingListNotifier] EmailJS error:", emailErr);
    }

    // Send SMS via Edge Function
    if (waiter.client_phone) {
      console.log("[WaitingListNotifier] Sending SMS to:", waiter.client_phone);
      const smsMsg = `House of Fades: A slot opened on ${date} at ${cancelledTime}! Accept: ${acceptLink} | Decline: ${declineLink}`;
      try {
        const smsResult = await supabase.functions.invoke("send-sms", {
          body: {
            action: "waiting-list-notify",
            phone: waiter.client_phone,
            message: smsMsg,
          },
        });
        console.log("[WaitingListNotifier] SMS result:", JSON.stringify(smsResult.data));
        if (smsResult.error) {
          console.error("[WaitingListNotifier] SMS invoke error:", smsResult.error);
        }
      } catch (smsErr) {
        console.error("[WaitingListNotifier] SMS exception:", smsErr);
      }
    }
  }

  // Set 15 minute timeout
  setTimeout(async () => {
    console.log("[WaitingListNotifier] 15min timeout - checking expired waiters");
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: expired } = await supabase
      .from("waiting_list")
      .select("*")
      .eq("barber_id", barberId)
      .eq("appointment_date", date)
      .eq("status", "notified")
      .lt("notified_at", fifteenMinAgo);

    if (expired && expired.length > 0) {
      console.log("[WaitingListNotifier] Expired waiters to cancel:", expired.length);
      for (const entry of expired) {
        await supabase.from("waiting_list").update({ status: "cancelled" }).eq("id", entry.id);
      }
    }
  }, 15 * 60 * 1000);
};
