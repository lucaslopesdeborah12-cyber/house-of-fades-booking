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

const BASE_URL = "https://house-of-fades-booking.lovable.app";

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

  for (const waiter of waiters) {
    console.log("[WaitingListNotifier] Notifying waiter:", waiter.client_name, waiter.client_email);

    const acceptLink = `${BASE_URL}/accept-booking?date=${date}&time=${cancelledTime}&barber=${barberId}&name=${encodeURIComponent(waiter.client_name)}&email=${encodeURIComponent(waiter.client_email || "")}&phone=${encodeURIComponent(waiter.client_phone || "")}&waitingId=${waiter.id}`;
    const declineLink = `${BASE_URL}/decline-booking?waitingId=${waiter.id}`;

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
    // EmailJS Service ID: service_ri5wxqg
    console.log("[WaitingListNotifier] Sending EmailJS notification to:", waiter.client_email);
    try {
      const emailResult = await emailjs.send(
        "service_ri5wxqg",
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
      const smsMsg = `House of Fades: A slot opened on ${date} at ${cancelledTime}! Be the first to accept: ${acceptLink}`;
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

  // No resend timer - notification is sent only once
};
