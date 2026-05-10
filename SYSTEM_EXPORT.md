# HOUSE OF FADES — Complete System Export

> Generated: 2026-04-11
> Stack: React 18 + Vite 5 + TypeScript + Tailwind CSS + Supabase + Lovable Cloud

## Table of Contents
1. [Environment Variables](#1-environment-variables)
2. [Database Schema (SQL)](#2-database-schema-sql)
3. [Edge Functions](#3-edge-functions)
4. [All Project Files](#4-all-project-files)
5. [Installation Guide](#5-step-by-step-installation-guide)
6. [Customization Prompt Template](#6-customization-prompt-template)

---
## 1. Environment Variables

These are set automatically by Lovable Cloud / Supabase:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_ID=<your-project-ref>
```

### Secrets (set in Edge Function secrets):

| Secret Name | Description |
|---|---|
| `SUPABASE_URL` | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase |
| `SUPABASE_ANON_KEY` | Auto-set by Supabase |
| `VONAGE_API_KEY` | Vonage SMS API key |
| `VONAGE_API_SECRET` | Vonage SMS API secret |
| `TWILIO_ACCOUNT_SID` | Twilio account SID (for voice calls) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (e.g. +1234567890) |

### Client-side keys (hardcoded in code):

| Key | Location | Description |
|---|---|---|
| EmailJS Public Key | `src/components/BookingModal.tsx` | `TBNWeHLfrq6OuvZhQ` |
| EmailJS Service ID | `src/components/BookingModal.tsx` | `service_y59db7l` |
| EmailJS Template (client) | `src/components/BookingModal.tsx` | `template_7i3p8r9` |
| EmailJS Template (owner) | `src/components/BookingModal.tsx` | `template_9wigrr6` |

---
## 2. Database Schema (SQL)

Run these SQL statements in order to recreate the database:

```sql
-- 1. Create enum
CREATE TYPE public.barber_role AS ENUM ('owner', 'employee');

-- 2. Create tables
CREATE TABLE public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.barbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role barber_role NOT NULL DEFAULT 'employee',
  commission_rate NUMERIC NOT NULL DEFAULT 0.50,
  photo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID NOT NULL REFERENCES public.barbers(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  appointment_date DATE NOT NULL,
  time_slot TIME NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  contact_preference TEXT DEFAULT 'both',
  status TEXT NOT NULL DEFAULT 'booked',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.booking_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  client_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.owner_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT
);
ALTER TABLE public.owner_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.site_content (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.waiting_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID NOT NULL,
  appointment_date DATE NOT NULL,
  time_slot TIME NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- 3. Create view
CREATE VIEW public.public_barbers AS
SELECT id, name, bio, photo_url FROM public.barbers;

-- 4. Database functions
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_barber_role(_user_id UUID)
RETURNS barber_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT role FROM public.barbers WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_barber_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT id FROM public.barbers WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 5. RLS Policies

-- admin_users
CREATE POLICY "Admin sees own record" ON public.admin_users FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- barbers
CREATE POLICY "Public can read barbers" ON public.barbers FOR SELECT TO public USING (true);
CREATE POLICY "Owner sees all barbers" ON public.barbers FOR SELECT TO authenticated USING (get_barber_role(auth.uid()) = 'owner');
CREATE POLICY "Employee sees own barber record" ON public.barbers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin sees all barbers" ON public.barbers FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can insert barbers" ON public.barbers FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update barbers" ON public.barbers FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete barbers" ON public.barbers FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- services
CREATE POLICY "Anyone can read services" ON public.services FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update services" ON public.services FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete services" ON public.services FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- appointments
CREATE POLICY "Public can read booked slots" ON public.appointments FOR SELECT TO public USING (true);
CREATE POLICY "Public can book appointments" ON public.appointments FOR INSERT TO public WITH CHECK (
  EXISTS (SELECT 1 FROM barbers WHERE barbers.id = appointments.barber_id)
  AND EXISTS (SELECT 1 FROM services WHERE services.id = appointments.service_id)
  AND client_name IS NOT NULL AND appointment_date >= CURRENT_DATE
);
CREATE POLICY "Owner sees all appointments" ON public.appointments FOR SELECT TO authenticated USING (get_barber_role(auth.uid()) = 'owner');
CREATE POLICY "Employee sees own appointments" ON public.appointments FOR SELECT TO authenticated USING (barber_id = get_barber_id(auth.uid()));
CREATE POLICY "Owner updates any appointment" ON public.appointments FOR UPDATE TO authenticated USING (get_barber_role(auth.uid()) = 'owner');
CREATE POLICY "Barbers update own appointments" ON public.appointments FOR UPDATE TO authenticated USING (barber_id = get_barber_id(auth.uid()));
CREATE POLICY "Admin sees all appointments" ON public.appointments FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin updates any appointment" ON public.appointments FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin deletes any appointment" ON public.appointments FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin inserts appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

-- reviews
CREATE POLICY "Anyone can read reviews" ON public.reviews FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update reviews" ON public.reviews FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete reviews" ON public.reviews FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- owner_settings
CREATE POLICY "Anyone can read owner settings" ON public.owner_settings FOR SELECT TO public USING (true);
CREATE POLICY "Owner can upsert settings" ON public.owner_settings FOR INSERT TO authenticated WITH CHECK (get_barber_role(auth.uid()) = 'owner' OR is_admin(auth.uid()));
CREATE POLICY "Owner can update settings" ON public.owner_settings FOR UPDATE TO authenticated USING (get_barber_role(auth.uid()) = 'owner' OR is_admin(auth.uid()));

-- site_content
CREATE POLICY "Anyone can read site content" ON public.site_content FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert site content" ON public.site_content FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update site content" ON public.site_content FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- waiting_list
CREATE POLICY "Public can read waiting list" ON public.waiting_list FOR SELECT TO public USING (true);
CREATE POLICY "Public can join waiting list" ON public.waiting_list FOR INSERT TO public WITH CHECK (client_name IS NOT NULL AND client_email IS NOT NULL AND appointment_date >= CURRENT_DATE);
CREATE POLICY "Public can update own waiting list status" ON public.waiting_list FOR UPDATE TO public USING (true) WITH CHECK (status = ANY(ARRAY['accepted','declined','cancelled']));
CREATE POLICY "Admin manages waiting list" ON public.waiting_list FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Owner manages waiting list" ON public.waiting_list FOR ALL TO authenticated USING (get_barber_role(auth.uid()) = 'owner');
CREATE POLICY "Barber updates own waiting list" ON public.waiting_list FOR UPDATE TO authenticated USING (barber_id = get_barber_id(auth.uid()));

-- 6. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('site-assets', 'site-assets', true);
CREATE POLICY "Public can read site assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'site-assets');
CREATE POLICY "Authenticated can upload site assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-assets');

```

---
## 3. Edge Functions

### `supabase/functions/admin-actions/index.ts`

```typescript
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
    // Verify the caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await callerClient.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: adminCheck } = await callerClient
      .from("admin_users")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Not an admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "create-barber") {
      const { email, password, name, role, commission_rate } = payload;
      if (!email || !password || !name) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user
      const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert barber record
      const { error: barberError } = await adminClient.from("barbers").insert({
        user_id: newUser.user.id,
        email,
        name,
        role: role || "employee",
        commission_rate: commission_rate || 0.50,
      });

      if (barberError) {
        return new Response(JSON.stringify({ error: barberError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-barber") {
      const { userId } = payload;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("barbers").delete().eq("user_id", userId);
      await adminClient.auth.admin.deleteUser(userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-barber-password") {
      const { userId, password } = payload;
      if (!userId || !password) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send-email") {
      // Placeholder - would need email service integration
      return new Response(JSON.stringify({ error: "Email service not configured yet" }), {
        status: 501,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

```

### `supabase/functions/book-appointment/index.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS_PER_IP = 10; // per hour
const MAX_ATTEMPTS_PER_EMAIL = 5; // per hour

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

    // Check IP rate limit
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

    // Check email rate limit
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

    // Record the attempt
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

    // Check slot availability
    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("barber_id", barber_id)
      .eq("appointment_date", appointment_date)
      .eq("time_slot", time_slot)
      .in("status", ["booked", "confirmed"]);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "This slot is no longer available" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert the appointment
    const { data: appointment, error: insertError } = await supabase.from("appointments").insert({
      barber_id,
      service_id,
      appointment_date,
      time_slot,
      client_name: client_name.trim(),
      client_phone: client_phone || null,
      client_email: client_email || null,
      contact_preference: contact_preference || "sms",
    }).select("id").single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to book appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cleanup old attempts (older than 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("booking_attempts").delete().lt("created_at", oneDayAgo);

    return new Response(JSON.stringify({ success: true, id: appointment.id }), {
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

```

### `supabase/functions/make-call/index.ts`

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    if (!TWILIO_ACCOUNT_SID) throw new Error("TWILIO_ACCOUNT_SID is not configured");

    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    if (!TWILIO_AUTH_TOKEN) throw new Error("TWILIO_AUTH_TOKEN is not configured");

    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");

    const { action, phone, clientName, barberName, serviceName, date, time, contactPreference } = await req.json();

    if (contactPreference && contactPreference !== 'call' && contactPreference !== 'all') {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      message = `Hello ${clientName}! This is a reminder from House of Fades. Your appointment with ${barberName} is today at ${time} in 2 hours. See you soon! Goodbye!`;
    } else {
      return new Response(JSON.stringify({ success: false, error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-GB">${message}</Say><Pause length="1"/><Say voice="alice" language="en-GB">${message}</Say></Response>`;

    console.log("[make-call] Calling:", phone, "Action:", action);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
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

```

### `supabase/functions/send-reminders/index.ts`

```typescript
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

```

### `supabase/functions/send-sms/index.ts`

```typescript
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

```

---
## 4. All Project Files

Total files: 113

### `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}

```

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>Lopes — Premium Barbershop in Carlow, Ireland</title>
    <meta name="description" content="Lopes is a premium barbershop in Carlow, Ireland. Book your haircut, skin fade, or hot towel shave with our expert barbers John, Mario &amp; CJ.">
    <meta name="author" content="Lopes" />

    
    
    <meta property="og:type" content="website" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@Lovable" />
    <meta name="twitter:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7aff3042-8512-4289-b87d-312a00e8a1cc?Expires=1775168125&amp;GoogleAccessId=go-api-on-aws%40gpt-engineer-390607.iam.gserviceaccount.com&amp;Signature=IzSXxKs7jKPf%2BJSz7pWGF3SohyXDCWM2g6mnSEQ3U6RflqhHcYKwARVY6IulplKzdUpT5tBu3xPD57XAWC7bl%2BxEWeU4ha3ZBodJgbYJfbTWyCrqxzXCbo72iqbtSx%2BRCjQG503FvI9czGJqVNa%2BA4ki2DDSmVS05prSb4o0St7eCdVy4qRuSeBtklCEkXJT03UGWeaeWntZLcybEc7KsokY7pGHo4bZnmwn33lgiK%2Fz9VdzV6sHA%2FCH5heLp24UVxli3OOZfza4jU7TEEhYBjtntBASlAvzq%2F6OaMwZeHA0uRFXl8ufoQ0aEDuMdg275AGoF3crgWG%2FiN6OPXkLUA%3D%3D">
    <meta property="og:title" content="Lopes — Premium Barbershop in Carlow, Ireland">
  <meta name="twitter:title" content="Lopes — Premium Barbershop in Carlow, Ireland">
  <meta property="og:description" content="Lopes is a premium barbershop in Carlow, Ireland. Book your haircut, skin fade, or hot towel shave with our expert barbers John, Mario &amp; CJ.">
  <meta name="twitter:description" content="Lopes is a premium barbershop in Carlow, Ireland. Book your haircut, skin fade, or hot towel shave with our expert barbers John, Mario &amp; CJ.">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta property="og:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7aff3042-8512-4289-b87d-312a00e8a1cc?Expires=1775168125&amp;GoogleAccessId=go-api-on-aws%40gpt-engineer-390607.iam.gserviceaccount.com&amp;Signature=IzSXxKs7jKPf%2BJSz7pWGF3SohyXDCWM2g6mnSEQ3U6RflqhHcYKwARVY6IulplKzdUpT5tBu3xPD57XAWC7bl%2BxEWeU4ha3ZBodJgbYJfbTWyCrqxzXCbo72iqbtSx%2BRCjQG503FvI9czGJqVNa%2BA4ki2DDSmVS05prSb4o0St7eCdVy4qRuSeBtklCEkXJT03UGWeaeWntZLcybEc7KsokY7pGHo4bZnmwn33lgiK%2Fz9VdzV6sHA%2FCH5heLp24UVxli3OOZfza4jU7TEEhYBjtntBASlAvzq%2F6OaMwZeHA0uRFXl8ufoQ0aEDuMdg275AGoF3crgWG%2FiN6OPXkLUA%3D%3D">
</head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

```

### `package.json`

```json
{
  "name": "vite_react_shadcn_ts",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@emailjs/browser": "^4.4.1",
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.11",
    "@radix-ui/react-alert-dialog": "^1.1.14",
    "@radix-ui/react-aspect-ratio": "^1.1.7",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.2",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-context-menu": "^2.2.15",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-hover-card": "^1.1.14",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-menubar": "^1.1.15",
    "@radix-ui/react-navigation-menu": "^1.2.13",
    "@radix-ui/react-popover": "^1.1.14",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-radio-group": "^1.3.7",
    "@radix-ui/react-scroll-area": "^1.2.9",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slider": "^1.3.5",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-toast": "^1.2.14",
    "@radix-ui/react-toggle": "^1.1.9",
    "@radix-ui/react-toggle-group": "^1.1.10",
    "@radix-ui/react-tooltip": "^1.2.7",
    "@supabase/supabase-js": "^2.101.1",
    "@tanstack/react-query": "^5.83.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^3.6.0",
    "embla-carousel-react": "^8.6.0",
    "framer-motion": "^12.38.0",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.462.0",
    "next-themes": "^0.3.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.61.1",
    "react-resizable-panels": "^2.1.9",
    "react-router-dom": "^6.30.1",
    "recharts": "^3.8.1",
    "sonner": "^1.7.4",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "vaul": "^0.9.9",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@playwright/test": "^1.57.0",
    "@tailwindcss/typography": "^0.5.16",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^22.16.5",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react-swc": "^3.11.0",
    "autoprefixer": "^10.4.21",
    "eslint": "^9.32.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^15.15.0",
    "jsdom": "^20.0.3",
    "lovable-tagger": "^1.1.13",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.38.0",
    "vite": "^5.4.19",
    "vitest": "^3.2.4"
  }
}

```

### `postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### `src/App.css`

```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}

```

### `src/App.tsx`

```tsx
import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import LoadingScreen from "@/components/LoadingScreen";
import Index from "./pages/Index.tsx";
import BarberPortal from "./pages/BarberPortal.tsx";
import AdminPortal from "./pages/AdminPortal.tsx";
import NotFound from "./pages/NotFound.tsx";
import WaitingListAccept from "./pages/WaitingListAccept.tsx";
import WaitingListDecline from "./pages/WaitingListDecline.tsx";
import AcceptBooking from "./pages/AcceptBooking.tsx";
import DeclineBooking from "./pages/DeclineBooking.tsx";

const queryClient = new QueryClient();

const App = () => {
  const [loaded, setLoaded] = useState(false);
  const onDone = useCallback(() => setLoaded(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {!loaded && <LoadingScreen onDone={onDone} />}
        <div className="grain-overlay" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/barber" element={<BarberPortal />} />
            <Route path="/admin" element={<AdminPortal />} />
            <Route path="/waiting-list/accept" element={<WaitingListAccept />} />
            <Route path="/waiting-list/decline" element={<WaitingListDecline />} />
            <Route path="/accept-booking" element={<AcceptBooking />} />
            <Route path="/decline-booking" element={<DeclineBooking />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;

```

### `src/components/AboutSection.tsx`

```tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import barberAction from "@/assets/barber-action.jpg";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const AboutSection = () => {
  const [aboutText, setAboutText] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", "about").maybeSingle().then(({ data }) => {
      if (data) {
        const val = data.value as any;
        setAboutText(val?.text || "");
      }
    });
  }, []);

  return (
    <section className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto max-w-6xl">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: easeOutExpo }}
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-card"
          >
            <img
              src={barberAction}
              alt="Barber at work"
              loading="lazy"
              width={800}
              height={800}
              onLoad={() => setImageLoaded(true)}
              className={`aspect-[4/4.6] w-full object-cover transition-all duration-700 ${imageLoaded ? "scale-100 blur-0" : "scale-105 blur-xl"}`}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.12, ease: easeOutExpo }}
          >
            <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">{t("about.label")}</p>
            <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">{t("about.title")}</h2>
            <p className="mt-6 font-body text-lg leading-relaxed text-foreground/86">
              {t("about.passion")}
            </p>
            <p className="mt-4 font-body leading-relaxed text-muted-foreground">
              {aboutText || t("about.fallback")}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;

```

### `src/components/AuthModal.tsx`

```tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

const AuthModal = ({ open, onOpenChange, onContinue }: AuthModalProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setMode('login');
    setLoading(false);
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (err) throw err;
        toast.success("Conta criada! Verifique o seu email.");
      }
      resetForm();
      onContinue();
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Insira o seu email primeiro');
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) {
      setError(err.message);
    } else {
      toast.success("Email de recuperação enviado!");
    }
  };

  const handleGuest = () => {
    resetForm();
    onContinue();
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetForm();
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="auth-modal-content p-0 overflow-hidden border-0"
        style={{
          maxWidth: 380,
          background: '#111',
          border: '1.5px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
        }}
      >
        <div style={{ opacity: 0, animation: 'authFadeUp 0.4s ease forwards' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', padding: '20px 20px 8px' }}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>✂️</span>
            <div style={{ fontSize: 18, color: '#C9A84C', fontFamily: 'Georgia', letterSpacing: 1 }}>
              House of Fades
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', fontFamily: 'Arial', marginTop: 2 }}>
              Carlow, Ireland
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', padding: '0 20px 4px' }}>
            <div style={{ fontSize: 14, color: '#fff', fontFamily: 'Georgia' }}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: 'Arial', marginTop: 2 }}>
              {mode === 'login' ? 'Entre com o seu email e senha' : 'Preencha os dados abaixo'}
            </div>
          </div>

          {/* Form */}
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 8, color: 'rgba(201,168,76,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial', marginBottom: 3, display: 'block' }}>
                  NOME
                </label>
                <div className="auth-border-box">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome"
                    style={{
                      background: '#181818', border: 'none', borderRadius: 11,
                      padding: '13px 14px', fontSize: 13, color: '#e0e0e0',
                      outline: 'none', width: '100%', fontFamily: 'Arial',
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 8, color: 'rgba(201,168,76,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial', marginBottom: 3, display: 'block' }}>
                EMAIL
              </label>
              <div className="auth-border-box">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@gmail.com"
                  style={{
                    background: '#181818', border: 'none', borderRadius: 11,
                    padding: '13px 14px', fontSize: 13, color: '#e0e0e0',
                    outline: 'none', width: '100%', fontFamily: 'Arial',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 8, color: 'rgba(201,168,76,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial', marginBottom: 3, display: 'block' }}>
                PASSWORD
              </label>
              <div className="auth-border-box">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    background: '#181818', border: 'none', borderRadius: 11,
                    padding: '13px 14px', fontSize: 13, color: '#e0e0e0',
                    outline: 'none', width: '100%', fontFamily: 'Arial',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Forgot password */}
          {mode === 'login' && (
            <div
              style={{ textAlign: 'right', padding: '6px 20px 0', fontSize: 10, color: 'rgba(201,168,76,0.45)', fontFamily: 'Arial', cursor: 'pointer' }}
              onClick={handleForgotPassword}
            >
              Esqueceu a senha?
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '8px 12px', background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.2)',
              borderRadius: 8, fontSize: 11, color: '#ff6b6b', fontFamily: 'Arial', margin: '8px 20px 0',
            }}>
              {error}
            </div>
          )}

          {/* Confirm button */}
          <div style={{ margin: '12px 20px 0' }}>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                opacity: 0, animation: 'authFadeUp 0.42s ease forwards 0.15s',
                background: '#C9A84C', border: 'none', borderRadius: 14, padding: 14,
                width: '100%', fontSize: 15, fontWeight: 'bold', color: '#111',
                fontFamily: 'Georgia', letterSpacing: 0.3, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'A entrar...' : mode === 'login' ? 'Entrar →' : 'Criar conta →'}
            </button>
          </div>

          {/* Divider */}
          <div style={{ padding: '0 20px', margin: '12px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'Arial' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Guest button */}
          <div style={{ margin: '0 20px' }}>
            <button
              onClick={handleGuest}
              style={{
                opacity: 0, animation: 'authFadeUp 0.42s ease forwards 0.22s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 11, background: 'rgba(255,255,255,0.02)',
                border: '1px dashed rgba(255,255,255,0.09)', borderRadius: 12,
                cursor: 'pointer', transition: 'all 0.2s', width: '100%',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
            >
              <span style={{ fontSize: 14 }}>⚡</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Arial' }}>Continuar sem conta</span>
              <span style={{ fontSize: 14, color: 'rgba(201,168,76,0.4)' }}>›</span>
            </button>
          </div>

          {/* Toggle mode */}
          <div style={{
            opacity: 0, animation: 'authFadeUp 0.38s ease forwards 0.28s',
            textAlign: 'center', padding: '10px 20px 16px', fontSize: 11,
            color: 'rgba(255,255,255,0.22)', fontFamily: 'Arial',
          }}>
            {mode === 'login' ? (
              <>Não tem conta?{' '}<span style={{ color: '#C9A84C', cursor: 'pointer' }} onClick={() => { setMode('register'); setError(''); }}>Criar agora</span></>
            ) : (
              <>Já tem conta?{' '}<span style={{ color: '#C9A84C', cursor: 'pointer' }} onClick={() => { setMode('login'); setError(''); }}>Entrar</span></>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;

```

### `src/components/BookingModal.tsx`

```tsx
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, User, Scissors, X, Check, Calendar as CalendarDownloadIcon, Lock, Zap } from "lucide-react";
import emailjs from "@emailjs/browser";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import CountryCodeSelector, { COUNTRIES, formatPhoneForSubmit, type Country } from "@/components/CountryCodeSelector";
import WaitingListForm from "@/components/WaitingListForm";
import { notifyWaitingList } from "@/lib/waitingListNotifier";
import { downloadICS } from "@/lib/calendarDownload";

// Initialize EmailJS once
emailjs.init("TBNWeHLfrq6OuvZhQ");

type Barber = { id: string; name: string };
type Service = { id: string; name: string; price: number; duration_minutes: number };

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];
const TOTAL_SLOTS = TIME_SLOTS.length;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedBarber?: string;
}

const BookingModal = ({ open, onOpenChange, preselectedBarber }: BookingModalProps) => {
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [monthAvailability, setMonthAvailability] = useState<Record<string, number>>({});
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  // calendarOpen removed — calendar is always inline
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [waitingListOpen, setWaitingListOpen] = useState(false);
  const [contactPreference, setContactPreference] = useState<'sms' | 'email' | 'call' | 'all' | null>(null);
  
  const [prefShakeTriggered, setPrefShakeTriggered] = useState(false);
  const { t } = useLanguage();

  const allSlotsBooked = selectedDate && bookedSlots.length >= TOTAL_SLOTS;

  // Urgency messages
  const availableSlots = selectedDate ? TOTAL_SLOTS - bookedSlots.length : 0;
  const occupancyPercent = selectedDate ? (bookedSlots.length / TOTAL_SLOTS) * 100 : 0;

  const getUrgencyMessage = () => {
    if (!selectedDate || allSlotsBooked) return null;
    if (availableSlots === 1) return "🔥 Only 1 spot left today!";
    if (availableSlots === 2) return "🔥 Only 2 spots left today!";
    if (occupancyPercent > 70) return "👀 High demand for this day!";
    return null;
  };


  useEffect(() => {
    if (!open) return;
    
    supabase
      .from("barbers")
      .select("id, name")
      .then(({ data, error }) => {
        if (error) {
          console.error("Barbers fetch error:", error);
        }
        if (data && data.length > 0) {
          setBarbers(data);
          if (preselectedBarber) {
            const match = data.find(b => b.name.toLowerCase() === preselectedBarber.toLowerCase());
            if (match) {
              setSelectedBarber(match.id);
              setStep(2);
            }
          }
        } else {
          console.error("No barbers returned. data:", data, "error:", error);
        }
      });

    supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) console.error("Services fetch error:", error);
        if (data) setServices(data);
      });
  }, [open, preselectedBarber]);

  const fetchBookedSlots = useCallback(async () => {
    if (!selectedBarber || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("appointments")
      .select("time_slot")
      .eq("barber_id", selectedBarber)
      .eq("appointment_date", dateStr)
      .in("status", ["booked", "confirmed"]);
    if (error) return;
    const slots = (data || []).map(d => d.time_slot.slice(0, 5));
    setBookedSlots(slots);
    if (selectedTime && slots.includes(selectedTime)) {
      setSelectedTime("");
    }
  }, [selectedBarber, selectedDate, selectedTime]);

  useEffect(() => {
    fetchBookedSlots();
  }, [selectedBarber, selectedDate]);

  useEffect(() => {
    if (!open || step !== 3) return;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = format(new Date(year, month, 1), "yyyy-MM-dd");
    const lastDay = format(new Date(year, month + 1, 0), "yyyy-MM-dd");

    const query = supabase
      .from("appointments")
      .select("appointment_date, barber_id")
      .gte("appointment_date", firstDay)
      .lte("appointment_date", lastDay)
      .in("status", ["booked", "confirmed"]);

    if (selectedBarber) {
      query.eq("barber_id", selectedBarber);
    }

    query.then(({ data }) => {
      if (!data) return;
      const countsByDate: Record<string, number> = {};
      if (selectedBarber) {
        data.forEach(row => {
          const d = row.appointment_date;
          countsByDate[d] = (countsByDate[d] || 0) + 1;
        });
      } else {
        const byDateBarber: Record<string, Record<string, number>> = {};
        data.forEach(row => {
          const d = row.appointment_date;
          const b = row.barber_id;
          if (!byDateBarber[d]) byDateBarber[d] = {};
          byDateBarber[d][b] = (byDateBarber[d][b] || 0) + 1;
        });
        Object.entries(byDateBarber).forEach(([date, barberCounts]) => {
          countsByDate[date] = Math.min(...Object.values(barberCounts));
        });
      }
      setMonthAvailability(countsByDate);
    });
  }, [open, step, selectedBarber, calendarMonth]);

  const getDayAvailabilityClass = (date: Date): string => {
    if (date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0) return "";
    const key = format(date, "yyyy-MM-dd");
    const booked = monthAvailability[key] || 0;
    const ratio = booked / TOTAL_SLOTS;
    if (ratio >= 1) return "full";
    if (ratio >= 0.81) return "red";
    if (ratio >= 0.61) return "orange";
    if (ratio >= 0.41) return "yellow";
    return "green";
  };

  const reset = () => {
    setStep(1);
    setSelectedBarber("");
    setSelectedService("");
    setSelectedDate(undefined);
    setSelectedTime("");
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setSuccess(false);
    setContactPreference(null);
    setPrefShakeTriggered(false);
    
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };


  const handleSubmit = async () => {
    if (!clientName.trim()) { toast.error(t("booking.enterName")); return; }
    if (contactPreference === null) { toast.error("Escolha como quer receber a confirmação"); return; }
    if ((contactPreference === 'email' || contactPreference === 'all') && !clientEmail.trim()) { toast.error(t("booking.enterEmail")); return; }
    if ((contactPreference === 'sms' || contactPreference === 'call' || contactPreference === 'all') && !clientPhone.trim()) { toast.error("Introduza o seu telefone"); return; }
    setSubmitting(true);
    const { data: bookResult, error } = await supabase.functions.invoke("book-appointment", {
      body: {
        barber_id: selectedBarber,
        service_id: selectedService,
        appointment_date: format(selectedDate!, "yyyy-MM-dd"),
        time_slot: selectedTime,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : null,
        client_email: clientEmail.trim() || null,
        contact_preference: contactPreference || 'sms',
      },
    });
    setSubmitting(false);
    if (error || (bookResult && bookResult.error)) {
      const errMsg = bookResult?.error || t("booking.errorBooking");
      toast.error(errMsg);
      console.error(error || bookResult?.error);
    } else {
      setSuccess(true);
      if (clientPhone.trim()) {
        supabase.functions.invoke("send-sms", {
          body: {
            action: "confirmation",
            phone: formatPhoneForSubmit(clientPhone, selectedCountry),
            clientName: clientName.trim(),
            barberName: selectedBarberName || "",
            serviceName: selectedServiceObj?.name || "",
            date: format(selectedDate!, "dd/MM/yyyy"),
            time: selectedTime,
          },
        }).catch(console.error);
      }
      const emailToSend = clientEmail.trim();
      if (emailToSend) {
        emailjs.send(
          "service_y59db7l",
          "template_7i3p8r9",
          {
            to_name: clientName.trim(),
            to_email: emailToSend,
            date: format(selectedDate!, "dd/MM/yyyy"),
            time: selectedTime,
            service: selectedServiceObj?.name || "",
            barber: selectedBarberName || "",
            price: `€${Number(selectedServiceObj?.price || 0).toFixed(0)}`,
          },
          "TBNWeHLfrq6OuvZhQ"
        ).catch((err) => console.error("EmailJS error:", err));
      }
      // Notify owner
      supabase
        .from("owner_settings" as any)
        .select("value")
        .eq("key", "notification_email")
        .maybeSingle()
        .then(({ data }: any) => {
          if (data?.value) {
            emailjs.send(
              "service_y59db7l",
              "template_9wigrr6",
              {
                to_name: "Owner",
                to_email: data.value,
                client_name: clientName.trim(),
                client_email: clientEmail.trim(),
                client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : "N/A",
                barber_name: selectedBarberName || "",
                service_name: selectedServiceObj?.name || "",
                appointment_date: format(selectedDate!, "dd/MM/yyyy"),
                appointment_time: selectedTime,
                service_price: `€${Number(selectedServiceObj?.price || 0).toFixed(0)}`,
                date: format(selectedDate!, "dd/MM/yyyy"),
                time: selectedTime,
              },
              "TBNWeHLfrq6OuvZhQ"
            ).catch((err) => console.error("Owner notification error:", err));
          }
        });
    }
  };

  const selectedBarberName = barbers.find(b => b.id === selectedBarber)?.name;
  const selectedServiceObj = services.find(s => s.id === selectedService);

  const handleDownloadCalendar = () => {
    if (!selectedDate || !selectedTime) return;
    downloadICS(
      format(selectedDate, "yyyy-MM-dd"),
      selectedTime,
      selectedBarberName || "Barber",
      selectedServiceObj?.name || "Haircut"
    );
  };

  const getGoogleCalendarUrl = () => {
    if (!selectedDate || !selectedTime) return "#";
    const [hour, minute] = selectedTime.split(":").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = format(selectedDate, "yyyyMMdd");
    const startStr = `${dateStr}T${pad(hour)}${pad(minute)}00`;
    const endH = minute + 30 >= 60 ? hour + 1 : hour;
    const endM = (minute + 30) % 60;
    const endStr = `${dateStr}T${pad(endH)}${pad(endM)}00`;
    const title = encodeURIComponent(`${selectedServiceObj?.name || "Haircut"} - House of Fades`);
    const details = encodeURIComponent(`Appointment with ${selectedBarberName || "Barber"}`);
    const location = encodeURIComponent("House of Fades, Carlow, Ireland");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-card border-accent/20 text-foreground w-full sm:w-[95vw] max-w-md max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6 sm:rounded-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl gold-title-gradient">
              {success ? "🎉 Booking Confirmed!" : t("booking.title")}
            </DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
                <Check size={32} className="text-[#4A7C2F]" />
              </div>
              <p className="font-body text-foreground font-medium text-lg">{t("booking.successMsg")}</p>
              <div className="text-sm text-muted-foreground font-body space-y-1 bg-background/50 rounded-lg p-4 border border-border">
                <p><strong>{t("booking.barber")}</strong> {selectedBarberName}</p>
                <p><strong>{t("booking.service")}</strong> {selectedServiceObj?.name}</p>
                <p><strong>{t("booking.date")}</strong> {selectedDate && format(selectedDate, "dd/MM/yyyy")}</p>
                <p><strong>{t("booking.time")}</strong> {selectedTime}</p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-accent hover:bg-accent/90 text-background font-body w-full h-10 px-4 rounded-md text-sm font-medium"
                >
                  <CalendarDownloadIcon size={16} className="mr-2" /> Add to Google Calendar 📅
                </a>
                <Button
                  onClick={handleDownloadCalendar}
                  variant="outline"
                  className="font-body w-full border-border text-xs h-8"
                  size="sm"
                >
                  Download .ics (Apple Calendar)
                </Button>
                <Button
                  onClick={() => { reset(); }}
                  variant="outline"
                  className="font-body w-full border-border"
                >
                  Book Another Appointment
                </Button>
                <Button onClick={() => handleClose(false)} variant="ghost" className="text-muted-foreground font-body text-sm">
                  {t("booking.close")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", step >= s ? "bg-accent" : "bg-muted/30")} />
                ))}
              </div>

              {step === 1 && (() => {
                const barberRoles: Record<string, string> = {
                  'John': 'Senior Barber',
                  'Mario': 'Fade Specialist',
                  'CJ': 'Style Expert'
                };
                return (
                <div>
                  <p className="font-body text-sm text-muted-foreground flex items-center gap-2 mb-2"><User size={16} /> {t("booking.chooseBarber")}</p>
                  <div style={{ padding: "4px 0 8px" }}>
                    {barbers.map((b, index) => {
                      const isSelected = selectedBarber === b.id;
                      const delays = [0.06, 0.16, 0.26];
                      return (
                        <button
                          key={b.id}
                          onClick={() => { setSelectedBarber(b.id); setStep(2); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            width: "100%",
                            padding: "13px 16px",
                            borderBottom: index < barbers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            borderLeft: "none",
                            borderRight: "none",
                            borderTop: "none",
                            background: isSelected ? "rgba(201,168,76,0.05)" : "transparent",
                            cursor: "pointer",
                            position: "relative",
                            transition: "all 0.22s ease",
                            opacity: 0,
                            animation: `fadeUp 0.44s ease forwards`,
                            animationDelay: `${delays[index] || 0.06 + index * 0.1}s`,
                          }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,168,76,0.05)"; }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        >
                          {/* Avatar */}
                          <div style={{
                            flexShrink: 0,
                            width: 46,
                            height: 46,
                            borderRadius: 12,
                            background: isSelected ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.04)",
                            border: isSelected ? "1px solid #C9A84C" : "1px solid rgba(255,255,255,0.07)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            color: isSelected ? "#C9A84C" : "rgba(201,168,76,0.4)",
                            fontWeight: "bold",
                            fontFamily: "Arial",
                            transition: "all 0.25s",
                          }}>
                            {b.name.charAt(0)}
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, textAlign: "left" }}>
                            <span style={{
                              fontSize: 15,
                              fontWeight: "bold",
                              letterSpacing: "0.2px",
                              display: "block",
                              ...(isSelected ? {
                                background: "linear-gradient(90deg, #C9A84C, #f5e49c, #C9A84C)",
                                backgroundSize: "300% auto",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                animation: "shimmerGold 1.8s linear infinite",
                              } : {
                                color: "#e0e0e0",
                              }),
                            }}>{b.name}</span>
                            <span style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.22)",
                              fontFamily: "Arial",
                              marginTop: 3,
                              fontWeight: "normal",
                              display: "block",
                            }}>{barberRoles[b.name] || 'Barber'}</span>
                          </div>
                          {/* Dot */}
                          <div style={{
                            flexShrink: 0,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            border: "1.5px solid rgba(201,168,76,0.2)",
                            transition: "all 0.25s",
                            ...(isSelected ? {
                              background: "#C9A84C",
                              borderColor: "#C9A84C",
                              boxShadow: "0 0 6px rgba(201,168,76,0.4)",
                            } : {}),
                          }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><Scissors size={16} /> {t("booking.chooseService")}</p>
                  <div style={{ position: "relative", padding: "4px 0 8px" }}>
                    <div style={{ position: "absolute", right: 26, top: 14, bottom: 14, width: 1, background: "rgba(201,168,76,0.1)" }} />
                    {services.map((s, index) => {
                      const isSelected = selectedService === s.id;
                      const delays = [0.06, 0.14, 0.22, 0.30, 0.38];
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedService(s.id); setStep(3); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            padding: isSelected ? "13px 42px 13px 16px" : "13px 36px 13px 16px",
                            position: "relative",
                            cursor: "pointer",
                            borderBottom: index < services.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            borderLeft: "none",
                            borderRight: "none",
                            borderTop: "none",
                            transition: "all 0.25s ease",
                            background: isSelected ? "rgba(201,168,76,0.04)" : "transparent",
                            animation: `fadeUp 0.42s ease forwards`,
                            animationDelay: `${delays[index] || 0.06 + index * 0.08}s`,
                            opacity: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.paddingRight = "42px"; e.currentTarget.style.background = "rgba(201,168,76,0.04)"; }}
                          onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.paddingRight = "36px"; e.currentTarget.style.background = "transparent"; } }}
                        >
                          <span style={{ flex: 1, fontSize: 14, color: isSelected ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "0.2px", textAlign: "left" }} className="font-body">
                            {s.name}
                          </span>
                          <div style={{ textAlign: "right", marginRight: 12, flexShrink: 0 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 2, fontFamily: "Arial" }}>
                              {s.duration_minutes} min
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: "bold",
                                ...(isSelected
                                  ? {
                                      background: "linear-gradient(90deg, #C9A84C, #f5e49c, #C9A84C)",
                                      backgroundSize: "300% auto",
                                      WebkitBackgroundClip: "text",
                                      WebkitTextFillColor: "transparent",
                                      animation: "shimmerGold 2s linear infinite",
                                    }
                                  : { color: "#C9A84C" }),
                              }}
                            >
                              €{Number(s.price).toFixed(0)}
                            </div>
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              right: 22,
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              border: isSelected ? "1.5px solid #C9A84C" : "1.5px solid rgba(201,168,76,0.25)",
                              background: isSelected ? "#C9A84C" : "#0e0e0e",
                              transition: "all 0.25s",
                              transform: isSelected ? "scale(1.35)" : "scale(1)",
                              boxShadow: isSelected ? "0 0 6px rgba(201,168,76,0.4)" : "none",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground font-body text-sm">{t("booking.back")}</Button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <p className="font-body text-sm text-muted-foreground flex items-center gap-2"><CalendarIcon size={16} /> {t("booking.chooseDateTime")}</p>

                  {/* Inline calendar — always visible */}
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => setSelectedDate(date)}
                      onMonthChange={setCalendarMonth}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0}
                      className={cn("p-3 pointer-events-auto w-full")}
                      modifiers={{
                        green: (date) => getDayAvailabilityClass(date) === "green",
                        yellow: (date) => getDayAvailabilityClass(date) === "yellow",
                        orange: (date) => getDayAvailabilityClass(date) === "orange",
                        red: (date) => getDayAvailabilityClass(date) === "red",
                        full: (date) => getDayAvailabilityClass(date) === "full",
                      }}
                      modifiersClassNames={{
                        green: "!bg-green-500/30 !text-green-300 font-bold",
                        yellow: "!bg-yellow-500/30 !text-yellow-300 font-bold",
                        orange: "!bg-orange-500/30 !text-orange-300 font-bold",
                        red: "!bg-red-500/30 !text-red-300 font-bold",
                        full: "!bg-gray-600/30 !text-gray-500 !line-through !opacity-60",
                      }}
                    />
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 justify-center text-xs font-body text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500/50 inline-block" /> Available</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500/50 inline-block" /> Filling up</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500/50 inline-block" /> Almost full</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500/50 inline-block" /> Last spots</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500/50 inline-block" /> Waitlist</span>
                  </div>

                  {selectedDate && (
                    <>
                      {/* Urgency messages */}
                      {getUrgencyMessage() && (
                        <div className="text-center py-2 px-3 rounded-md bg-accent/10 border border-accent/30">
                          <p className="font-body text-sm text-accent font-medium">{getUrgencyMessage()}</p>
                        </div>
                      )}

                      {allSlotsBooked ? (
                        <div
                          className="flex flex-col items-center text-center gap-3"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            borderRadius: "14px",
                            padding: "22px 16px",
                          }}
                        >
                          <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                            <Lock size={24} className="text-muted-foreground" />
                          </div>
                          <h3 className="font-serif text-lg font-semibold text-foreground">This day is fully booked</h3>
                          <p className="font-body text-sm text-muted-foreground leading-relaxed">
                            All slots are taken — but you can join the waiting list and be notified instantly if someone cancels.
                          </p>
                          <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1 text-xs font-body">
                            <Zap size={12} className="text-accent" /> Instant notification if a slot opens
                          </Badge>
                          <Button
                            onClick={() => setWaitingListOpen(true)}
                            className="bg-accent hover:bg-accent/90 text-background font-body text-base px-8 py-3 w-full mt-1"
                          >
                            📋 Join Waiting List
                          </Button>
                          <Button
                            onClick={() => setSelectedDate(undefined)}
                            variant="outline"
                            className="font-body text-sm w-full border-border"
                          >
                            Choose another day
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {TIME_SLOTS.map(tm => {
                            const booked = bookedSlots.includes(tm);
                            return (
                              <button
                                key={tm}
                                disabled={booked}
                                onClick={() => setSelectedTime(tm)}
                                className={cn(
                                  "py-2 rounded text-sm font-body transition-all border",
                                  booked
                                    ? "border-border text-muted-foreground/40 cursor-not-allowed line-through"
                                    : selectedTime === tm
                                      ? "border-accent bg-accent/20 text-foreground"
                                      : "border-border hover:border-accent/50 text-foreground"
                                )}
                              >
                                {tm}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep(2)} className="text-muted-foreground font-body text-sm">{t("booking.back")}</Button>
                    {selectedDate && selectedTime && !allSlotsBooked && (
                      <Button onClick={() => setStep(4)} className="bg-accent hover:bg-accent/90 text-background font-body ml-auto">
                        {t("booking.continue")}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (() => {
                const showEmailField = (contactPreference === 'email' || contactPreference === 'all');
                const hideEmailField = (contactPreference === 'sms' || contactPreference === 'call');
                const emailDisabled = contactPreference === null;
                const showPhoneField = contactPreference === 'sms' || contactPreference === 'call' || contactPreference === 'all';
                const hidePhoneField = contactPreference === 'email';
                const phoneDisabled = contactPreference === null;
                const needsWarning = contactPreference === null && clientName.length > 0;

                // Trigger shake once
                if (needsWarning && !prefShakeTriggered) {
                  setPrefShakeTriggered(true);
                }

                const isConfirmDisabled = submitting || !clientName.trim() || contactPreference === null ||
                  ((contactPreference === 'email' || contactPreference === 'all') && !clientEmail.trim()) ||
                  ((contactPreference === 'sms' || contactPreference === 'call' || contactPreference === 'all') && !clientPhone.trim());

                return (
                <div style={{ padding: "0 0 14px" }}>
                  {/* Section label */}
                  <div style={{
                    fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 1, textTransform: "uppercase" as const,
                    fontFamily: "Arial", display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
                  }}>
                    <span style={{ width: 14, height: 1, background: "rgba(201,168,76,0.3)", display: "inline-block" }} />
                    Seus dados
                  </div>

                  {/* Contact preference pills */}
                  <div style={{ opacity: 0, animation: "fadeUpForm 0.38s ease forwards", animationDelay: "0.05s", marginBottom: 10 }}>
                    {needsWarning && (
                      <div style={{ fontSize: 11, color: "#ff4444", fontFamily: "Arial", marginBottom: 8, animation: prefShakeTriggered ? "prefShake 0.4s ease" : "none" }}>
                        ⚠️ Escolha como quer receber a confirmação
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", fontFamily: "Arial", marginBottom: 8, lineHeight: 1.4 }}>
                      Qual a sua <span style={{ color: "#C9A84C" }}>melhor forma</span> de receber confirmação?
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                      {([
                        { value: 'sms' as const, label: '📱 SMS' },
                        { value: 'email' as const, label: '✉️ Email' },
                        { value: 'call' as const, label: '📞 Ligação' },
                        { value: 'all' as const, label: '🔔 Todos' },
                      ]).map(pill => {
                        const isActive = contactPreference === pill.value;
                        const isRedState = needsWarning;
                        return (
                          <button
                            key={pill.value}
                            type="button"
                            onClick={() => {
                              setContactPreference(pill.value);
                              if (!clientName.trim()) {
                                const nameInput = document.querySelector<HTMLInputElement>('input[placeholder="Nome *"]');
                                // Focus removed to prevent iOS Safari zoom
                              }
                            }}
                            style={{
                              flex: 1,
                              background: isActive ? "rgba(201,168,76,0.12)" : isRedState ? "rgba(220,50,50,0.05)" : "rgba(255,255,255,0.04)",
                              border: `1.5px solid ${isActive ? "#C9A84C" : isRedState ? "rgba(220,50,50,0.6)" : "rgba(255,255,255,0.09)"}`,
                              borderRadius: 99,
                              padding: "9px 4px",
                              fontSize: 10,
                              color: isActive ? "#C9A84C" : isRedState ? "rgba(220,50,50,0.8)" : "rgba(255,255,255,0.35)",
                              fontFamily: "Arial",
                              fontWeight: isActive ? 500 : 400,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              transition: "all 0.22s",
                              animation: isRedState && !isActive ? "prefPulse 1.5s ease infinite" : "none",
                            }}
                          >
                            {pill.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nome field */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8, opacity: 0, animation: "fadeUpForm 0.42s ease forwards", animationDelay: "0.12s" }}>
                    <span style={{ fontSize: 9, color: "rgba(201,168,76,0.5)", letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "Arial" }}>Nome</span>
                    <div className="border-run-box" style={{ padding: 1.5, borderRadius: 12, background: "rgba(255,255,255,0.07)" }}>
                      <input
                        placeholder="Nome *"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        style={{ background: "#181818", border: "none", borderRadius: 11, padding: "13px 14px", fontSize: "16px", color: "#e0e0e0", outline: "none", width: "100%", fontFamily: "Arial", WebkitTextSizeAdjust: "none", touchAction: "manipulation" }}
                        onFocus={e => {
                          const box = e.currentTarget.parentElement;
                          if (box) { box.style.background = "linear-gradient(90deg, #A07830, #C9A84C, #f5e49c, #C9A84C, #A07830)"; box.style.backgroundSize = "200% auto"; box.style.animation = "borderRun 1.8s linear infinite"; }
                          const lbl = box?.parentElement?.querySelector("span");
                          if (lbl) lbl.style.color = "#C9A84C";
                        }}
                        onBlur={e => {
                          const box = e.currentTarget.parentElement;
                          if (box) { box.style.background = "rgba(255,255,255,0.07)"; box.style.animation = "none"; }
                          const lbl = box?.parentElement?.querySelector("span");
                          if (lbl) lbl.style.color = "rgba(201,168,76,0.5)";
                        }}
                      />
                    </div>
                  </div>

                  {/* Email + Phone row */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    {/* Email */}
                    {!hideEmailField && (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, opacity: 0, animation: "fadeUpForm 0.42s ease forwards", animationDelay: "0.18s" }}>
                        <span style={{ fontSize: 9, color: "rgba(201,168,76,0.5)", letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "Arial" }}>
                          Email
                        </span>
                        <div className="border-run-box" style={{
                          padding: 1.5, borderRadius: 12,
                          background: "rgba(255,255,255,0.07)",
                          ...(emailDisabled ? { opacity: 0.4 } : {}),
                        }}>
                          <input
                            placeholder={emailDisabled ? "Escolha uma opção acima primeiro" : "Email *"}
                            type="email"
                            value={clientEmail}
                            onChange={e => setClientEmail(e.target.value)}
                            disabled={emailDisabled}
                            style={{
                              background: "#181818",
                              border: "none",
                              borderRadius: 11, padding: "13px 14px", fontSize: "16px",
                              color: "#e0e0e0",
                              outline: "none", width: "100%", fontFamily: "Arial",
                              cursor: emailDisabled ? "not-allowed" : "text",
                              WebkitTextSizeAdjust: "none", touchAction: "manipulation",
                            }}
                            onFocus={e => {
                              if (emailDisabled) return;
                              const box = e.currentTarget.parentElement;
                              if (box) { box.style.background = "linear-gradient(90deg, #A07830, #C9A84C, #f5e49c, #C9A84C, #A07830)"; box.style.backgroundSize = "200% auto"; box.style.animation = "borderRun 1.8s linear infinite"; }
                              const lbl = box?.parentElement?.querySelector("span");
                              if (lbl) lbl.style.color = "#C9A84C";
                            }}
                            onBlur={e => {
                              if (emailDisabled) return;
                              const box = e.currentTarget.parentElement;
                              if (box) { box.style.background = "rgba(255,255,255,0.07)"; box.style.animation = "none"; }
                              const lbl = box?.parentElement?.querySelector("span");
                              if (lbl) lbl.style.color = "rgba(201,168,76,0.5)";
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {/* Phone */}
                    {!hidePhoneField && (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, opacity: 0, animation: "fadeUpForm 0.42s ease forwards", animationDelay: "0.21s", ...(phoneDisabled ? { opacity: 0.4 } : {}) }}>
                        <span style={{ fontSize: 9, color: "rgba(201,168,76,0.5)", letterSpacing: 1.5, textTransform: "uppercase" as const, fontFamily: "Arial" }}>Telefone</span>
                        <div className="border-run-box" style={{ padding: 1.5, borderRadius: 12, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center" }}>
                          <div style={{ flexShrink: 0 }}>
                            <CountryCodeSelector selected={selectedCountry} onSelect={setSelectedCountry} />
                          </div>
                          <input
                            placeholder={selectedCountry.code === "IE" ? "085 123 4567" : t("booking.phone")}
                            value={clientPhone}
                            onChange={e => setClientPhone(e.target.value.replace(/[^0-9]/g, ''))}
                            disabled={phoneDisabled}
                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "13px 10px", fontSize: "16px", color: "#e0e0e0", fontFamily: "Arial", WebkitTextSizeAdjust: "none", touchAction: "manipulation", cursor: phoneDisabled ? "not-allowed" : "text" }}
                            onFocus={e => {
                              if (phoneDisabled) return;
                              const box = e.currentTarget.parentElement;
                              if (box) { box.style.background = "linear-gradient(90deg, #A07830, #C9A84C, #f5e49c, #C9A84C, #A07830)"; box.style.backgroundSize = "200% auto"; box.style.animation = "borderRun 1.8s linear infinite"; }
                              const lbl = box?.parentElement?.querySelector("span");
                              if (lbl) lbl.style.color = "#C9A84C";
                            }}
                            onBlur={e => {
                              if (phoneDisabled) return;
                              const box = e.currentTarget.parentElement;
                              if (box) { box.style.background = "rgba(255,255,255,0.07)"; box.style.animation = "none"; }
                              const lbl = box?.parentElement?.querySelector("span");
                              if (lbl) lbl.style.color = "rgba(201,168,76,0.5)";
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary card */}
                  <div style={{
                    opacity: 0, animation: "fadeUpForm 0.4s ease forwards", animationDelay: "0.2s",
                    background: "#1a1a1a", borderRadius: 14, padding: "13px 14px", marginBottom: 10,
                  }}>
                    <div style={{
                      fontSize: 8, color: "rgba(201,168,76,0.45)", letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: "Arial",
                      marginBottom: 9, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,0.05)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span>Resumo</span>
                      <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(74,124,47,0.2)", border: "1px solid rgba(74,124,47,0.4)", color: "#4A7C2F", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                      {[
                        { label: "Barbeiro", value: selectedBarberName || "" },
                        { label: "Serviço", value: selectedServiceObj?.name || "" },
                        { label: "Data", value: selectedDate ? format(selectedDate, "dd/MM/yyyy") : "" },
                        { label: "Hora", value: selectedTime },
                      ].map((row) => (
                        <div key={row.label} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "Arial", marginBottom: 2 }}>{row.label}</div>
                          <div style={{ fontSize: 12, color: "#e0e0e0", fontWeight: 500 }}>{row.value}</div>
                        </div>
                      ))}
                      <div style={{ gridColumn: "span 2", borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: 4, paddingTop: 8 }}>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "Arial", marginBottom: 2 }}>Total</div>
                        <div style={{
                          background: "linear-gradient(90deg, #C9A84C, #f5e49c, #C9A84C)", backgroundSize: "300% auto",
                          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                          animation: "shimmerGold 2s linear infinite", fontWeight: "bold", fontFamily: "Georgia", fontSize: 15,
                        }}>€{Number(selectedServiceObj?.price || 0).toFixed(0)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handleSubmit}
                    disabled={isConfirmDisabled}
                    style={{
                      opacity: 0, animation: "fadeUpForm 0.42s ease forwards", animationDelay: "0.34s",
                      background: "#C9A84C", border: "none", borderRadius: 14, padding: 15,
                      width: "100%", fontSize: 15, fontWeight: "bold", color: "#111", fontFamily: "Georgia", letterSpacing: 0.3,
                      cursor: isConfirmDisabled ? "not-allowed" : "pointer",
                      ...(isConfirmDisabled ? { filter: "opacity(0.5)" } : {}),
                    }}
                  >
                    {submitting ? t("booking.confirming") : "Confirmar →"}
                  </button>

                  {/* Back button */}
                  <div onClick={() => setStep(3)} style={{ textAlign: "center", padding: "8px 0 2px", fontSize: 12, color: "rgba(255,255,255,0.18)", cursor: "pointer", fontFamily: "Arial" }}>
                    ← Voltar
                  </div>
                </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedDate && selectedBarber && (
        <WaitingListForm
          open={waitingListOpen}
          onOpenChange={setWaitingListOpen}
          date={selectedDate}
          barberId={selectedBarber}
          barberName={selectedBarberName || ""}
        />
      )}
    </>
  );
};

export default BookingModal;

```

### `src/components/CountryCodeSelector.tsx`

```tsx
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type Country = {
  code: string;
  name: string;
  dial: string;
  flag: string;
};

const COUNTRIES: Country[] = [
  { code: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { code: "AF", name: "Afghanistan", dial: "+93", flag: "🇦🇫" },
  { code: "AL", name: "Albania", dial: "+355", flag: "🇦🇱" },
  { code: "DZ", name: "Algeria", dial: "+213", flag: "🇩🇿" },
  { code: "AS", name: "American Samoa", dial: "+1684", flag: "🇦🇸" },
  { code: "AD", name: "Andorra", dial: "+376", flag: "🇦🇩" },
  { code: "AO", name: "Angola", dial: "+244", flag: "🇦🇴" },
  { code: "AG", name: "Antigua & Barbuda", dial: "+1268", flag: "🇦🇬" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "AM", name: "Armenia", dial: "+374", flag: "🇦🇲" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "AT", name: "Austria", dial: "+43", flag: "🇦🇹" },
  { code: "AZ", name: "Azerbaijan", dial: "+994", flag: "🇦🇿" },
  { code: "BS", name: "Bahamas", dial: "+1242", flag: "🇧🇸" },
  { code: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "BB", name: "Barbados", dial: "+1246", flag: "🇧🇧" },
  { code: "BY", name: "Belarus", dial: "+375", flag: "🇧🇾" },
  { code: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { code: "BZ", name: "Belize", dial: "+501", flag: "🇧🇿" },
  { code: "BJ", name: "Benin", dial: "+229", flag: "🇧🇯" },
  { code: "BT", name: "Bhutan", dial: "+975", flag: "🇧🇹" },
  { code: "BO", name: "Bolivia", dial: "+591", flag: "🇧🇴" },
  { code: "BA", name: "Bosnia & Herzegovina", dial: "+387", flag: "🇧🇦" },
  { code: "BW", name: "Botswana", dial: "+267", flag: "🇧🇼" },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { code: "BN", name: "Brunei", dial: "+673", flag: "🇧🇳" },
  { code: "BG", name: "Bulgaria", dial: "+359", flag: "🇧🇬" },
  { code: "BF", name: "Burkina Faso", dial: "+226", flag: "🇧🇫" },
  { code: "BI", name: "Burundi", dial: "+257", flag: "🇧🇮" },
  { code: "KH", name: "Cambodia", dial: "+855", flag: "🇰🇭" },
  { code: "CM", name: "Cameroon", dial: "+237", flag: "🇨🇲" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "CV", name: "Cape Verde", dial: "+238", flag: "🇨🇻" },
  { code: "CF", name: "Central African Republic", dial: "+236", flag: "🇨🇫" },
  { code: "TD", name: "Chad", dial: "+235", flag: "🇹🇩" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { code: "KM", name: "Comoros", dial: "+269", flag: "🇰🇲" },
  { code: "CG", name: "Congo", dial: "+242", flag: "🇨🇬" },
  { code: "CD", name: "Congo (DRC)", dial: "+243", flag: "🇨🇩" },
  { code: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225", flag: "🇨🇮" },
  { code: "HR", name: "Croatia", dial: "+385", flag: "🇭🇷" },
  { code: "CU", name: "Cuba", dial: "+53", flag: "🇨🇺" },
  { code: "CY", name: "Cyprus", dial: "+357", flag: "🇨🇾" },
  { code: "CZ", name: "Czech Republic", dial: "+420", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰" },
  { code: "DJ", name: "Djibouti", dial: "+253", flag: "🇩🇯" },
  { code: "DM", name: "Dominica", dial: "+1767", flag: "🇩🇲" },
  { code: "DO", name: "Dominican Republic", dial: "+1809", flag: "🇩🇴" },
  { code: "EC", name: "Ecuador", dial: "+593", flag: "🇪🇨" },
  { code: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { code: "SV", name: "El Salvador", dial: "+503", flag: "🇸🇻" },
  { code: "GQ", name: "Equatorial Guinea", dial: "+240", flag: "🇬🇶" },
  { code: "ER", name: "Eritrea", dial: "+291", flag: "🇪🇷" },
  { code: "EE", name: "Estonia", dial: "+372", flag: "🇪🇪" },
  { code: "SZ", name: "Eswatini", dial: "+268", flag: "🇸🇿" },
  { code: "ET", name: "Ethiopia", dial: "+251", flag: "🇪🇹" },
  { code: "FJ", name: "Fiji", dial: "+679", flag: "🇫🇯" },
  { code: "FI", name: "Finland", dial: "+358", flag: "🇫🇮" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "GA", name: "Gabon", dial: "+241", flag: "🇬🇦" },
  { code: "GM", name: "Gambia", dial: "+220", flag: "🇬🇲" },
  { code: "GE", name: "Georgia", dial: "+995", flag: "🇬🇪" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", dial: "+233", flag: "🇬🇭" },
  { code: "GR", name: "Greece", dial: "+30", flag: "🇬🇷" },
  { code: "GD", name: "Grenada", dial: "+1473", flag: "🇬🇩" },
  { code: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹" },
  { code: "GN", name: "Guinea", dial: "+224", flag: "🇬🇳" },
  { code: "GW", name: "Guinea-Bissau", dial: "+245", flag: "🇬🇼" },
  { code: "GY", name: "Guyana", dial: "+592", flag: "🇬🇾" },
  { code: "HT", name: "Haiti", dial: "+509", flag: "🇭🇹" },
  { code: "HN", name: "Honduras", dial: "+504", flag: "🇭🇳" },
  { code: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { code: "HU", name: "Hungary", dial: "+36", flag: "🇭🇺" },
  { code: "IS", name: "Iceland", dial: "+354", flag: "🇮🇸" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "IR", name: "Iran", dial: "+98", flag: "🇮🇷" },
  { code: "IQ", name: "Iraq", dial: "+964", flag: "🇮🇶" },
  { code: "IL", name: "Israel", dial: "+972", flag: "🇮🇱" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "JM", name: "Jamaica", dial: "+1876", flag: "🇯🇲" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { code: "JO", name: "Jordan", dial: "+962", flag: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan", dial: "+7", flag: "🇰🇿" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "KI", name: "Kiribati", dial: "+686", flag: "🇰🇮" },
  { code: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { code: "KG", name: "Kyrgyzstan", dial: "+996", flag: "🇰🇬" },
  { code: "LA", name: "Laos", dial: "+856", flag: "🇱🇦" },
  { code: "LV", name: "Latvia", dial: "+371", flag: "🇱🇻" },
  { code: "LB", name: "Lebanon", dial: "+961", flag: "🇱🇧" },
  { code: "LS", name: "Lesotho", dial: "+266", flag: "🇱🇸" },
  { code: "LR", name: "Liberia", dial: "+231", flag: "🇱🇷" },
  { code: "LY", name: "Libya", dial: "+218", flag: "🇱🇾" },
  { code: "LI", name: "Liechtenstein", dial: "+423", flag: "🇱🇮" },
  { code: "LT", name: "Lithuania", dial: "+370", flag: "🇱🇹" },
  { code: "LU", name: "Luxembourg", dial: "+352", flag: "🇱🇺" },
  { code: "MO", name: "Macau", dial: "+853", flag: "🇲🇴" },
  { code: "MG", name: "Madagascar", dial: "+261", flag: "🇲🇬" },
  { code: "MW", name: "Malawi", dial: "+265", flag: "🇲🇼" },
  { code: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { code: "MV", name: "Maldives", dial: "+960", flag: "🇲🇻" },
  { code: "ML", name: "Mali", dial: "+223", flag: "🇲🇱" },
  { code: "MT", name: "Malta", dial: "+356", flag: "🇲🇹" },
  { code: "MH", name: "Marshall Islands", dial: "+692", flag: "🇲🇭" },
  { code: "MR", name: "Mauritania", dial: "+222", flag: "🇲🇷" },
  { code: "MU", name: "Mauritius", dial: "+230", flag: "🇲🇺" },
  { code: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { code: "FM", name: "Micronesia", dial: "+691", flag: "🇫🇲" },
  { code: "MD", name: "Moldova", dial: "+373", flag: "🇲🇩" },
  { code: "MC", name: "Monaco", dial: "+377", flag: "🇲🇨" },
  { code: "MN", name: "Mongolia", dial: "+976", flag: "🇲🇳" },
  { code: "ME", name: "Montenegro", dial: "+382", flag: "🇲🇪" },
  { code: "MA", name: "Morocco", dial: "+212", flag: "🇲🇦" },
  { code: "MZ", name: "Mozambique", dial: "+258", flag: "🇲🇿" },
  { code: "MM", name: "Myanmar", dial: "+95", flag: "🇲🇲" },
  { code: "NA", name: "Namibia", dial: "+264", flag: "🇳🇦" },
  { code: "NR", name: "Nauru", dial: "+674", flag: "🇳🇷" },
  { code: "NP", name: "Nepal", dial: "+977", flag: "🇳🇵" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { code: "NI", name: "Nicaragua", dial: "+505", flag: "🇳🇮" },
  { code: "NE", name: "Niger", dial: "+227", flag: "🇳🇪" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "KP", name: "North Korea", dial: "+850", flag: "🇰🇵" },
  { code: "MK", name: "North Macedonia", dial: "+389", flag: "🇲🇰" },
  { code: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { code: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "PW", name: "Palau", dial: "+680", flag: "🇵🇼" },
  { code: "PS", name: "Palestine", dial: "+970", flag: "🇵🇸" },
  { code: "PA", name: "Panama", dial: "+507", flag: "🇵🇦" },
  { code: "PG", name: "Papua New Guinea", dial: "+675", flag: "🇵🇬" },
  { code: "PY", name: "Paraguay", dial: "+595", flag: "🇵🇾" },
  { code: "PE", name: "Peru", dial: "+51", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { code: "RO", name: "Romania", dial: "+40", flag: "🇷🇴" },
  { code: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { code: "RW", name: "Rwanda", dial: "+250", flag: "🇷🇼" },
  { code: "KN", name: "Saint Kitts & Nevis", dial: "+1869", flag: "🇰🇳" },
  { code: "LC", name: "Saint Lucia", dial: "+1758", flag: "🇱🇨" },
  { code: "VC", name: "Saint Vincent", dial: "+1784", flag: "🇻🇨" },
  { code: "WS", name: "Samoa", dial: "+685", flag: "🇼🇸" },
  { code: "SM", name: "San Marino", dial: "+378", flag: "🇸🇲" },
  { code: "ST", name: "São Tomé & Príncipe", dial: "+239", flag: "🇸🇹" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "SN", name: "Senegal", dial: "+221", flag: "🇸🇳" },
  { code: "RS", name: "Serbia", dial: "+381", flag: "🇷🇸" },
  { code: "SC", name: "Seychelles", dial: "+248", flag: "🇸🇨" },
  { code: "SL", name: "Sierra Leone", dial: "+232", flag: "🇸🇱" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "SK", name: "Slovakia", dial: "+421", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", dial: "+386", flag: "🇸🇮" },
  { code: "SB", name: "Solomon Islands", dial: "+677", flag: "🇸🇧" },
  { code: "SO", name: "Somalia", dial: "+252", flag: "🇸🇴" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { code: "SS", name: "South Sudan", dial: "+211", flag: "🇸🇸" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { code: "SD", name: "Sudan", dial: "+249", flag: "🇸🇩" },
  { code: "SR", name: "Suriname", dial: "+597", flag: "🇸🇷" },
  { code: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { code: "SY", name: "Syria", dial: "+963", flag: "🇸🇾" },
  { code: "TW", name: "Taiwan", dial: "+886", flag: "🇹🇼" },
  { code: "TJ", name: "Tajikistan", dial: "+992", flag: "🇹🇯" },
  { code: "TZ", name: "Tanzania", dial: "+255", flag: "🇹🇿" },
  { code: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { code: "TL", name: "Timor-Leste", dial: "+670", flag: "🇹🇱" },
  { code: "TG", name: "Togo", dial: "+228", flag: "🇹🇬" },
  { code: "TO", name: "Tonga", dial: "+676", flag: "🇹🇴" },
  { code: "TT", name: "Trinidad & Tobago", dial: "+1868", flag: "🇹🇹" },
  { code: "TN", name: "Tunisia", dial: "+216", flag: "🇹🇳" },
  { code: "TR", name: "Turkey", dial: "+90", flag: "🇹🇷" },
  { code: "TM", name: "Turkmenistan", dial: "+993", flag: "🇹🇲" },
  { code: "TV", name: "Tuvalu", dial: "+688", flag: "🇹🇻" },
  { code: "UG", name: "Uganda", dial: "+256", flag: "🇺🇬" },
  { code: "UA", name: "Ukraine", dial: "+380", flag: "🇺🇦" },
  { code: "AE", name: "UAE", dial: "+971", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾" },
  { code: "UZ", name: "Uzbekistan", dial: "+998", flag: "🇺🇿" },
  { code: "VU", name: "Vanuatu", dial: "+678", flag: "🇻🇺" },
  { code: "VA", name: "Vatican City", dial: "+379", flag: "🇻🇦" },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪" },
  { code: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
  { code: "YE", name: "Yemen", dial: "+967", flag: "🇾🇪" },
  { code: "ZM", name: "Zambia", dial: "+260", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", dial: "+263", flag: "🇿🇼" },
];

/** Strip leading zero for Ireland, return clean number for international format */
export const formatPhoneForSubmit = (phone: string, country: Country): string => {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return "";
  // Ireland: remove leading 0
  if (country.code === "IE" && digits.startsWith("0")) {
    return `${country.dial}${digits.slice(1)}`;
  }
  return `${country.dial}${digits}`;
};

interface Props {
  selected: Country;
  onSelect: (country: Country) => void;
}

const CountryCodeSelector = ({ selected, onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 h-10 rounded-l-md border border-r-0 border-border bg-muted text-muted-foreground text-sm font-body hover:bg-muted/80 transition-colors shrink-0"
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span>{selected.dial}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-card border-border max-h-72 overflow-hidden" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Buscar país..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm bg-background border-border text-foreground"
            
          />
        </div>
        <div className="overflow-y-auto max-h-56">
          {filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                onSelect(c);
                setOpen(false);
                setSearch("");
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm font-body text-left hover:bg-accent/10 transition-colors",
                selected.code === c.code && "bg-accent/10 text-foreground"
              )}
            >
              <span className="text-base">{c.flag}</span>
              <span className="flex-1 text-foreground truncate">{c.name}</span>
              <span className="text-muted-foreground text-xs">{c.dial}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CountryCodeSelector;
export { COUNTRIES };

```

### `src/components/CursorGlow.tsx`

```tsx
import { useEffect, useRef } from "react";

const CursorGlow = () => {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX - 150}px, ${e.clientY - 150}px)`;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={glowRef}
      className="pointer-events-none fixed top-0 left-0 z-[9999] w-[300px] h-[300px] rounded-full opacity-20 mix-blend-screen"
      style={{
        background: "radial-gradient(circle, hsla(43, 74%, 52%, 0.22) 0%, transparent 70%)",
        transition: "transform 0.15s ease-out",
      }}
    />
  );
};

export default CursorGlow;

```

### `src/components/FadeInStagger.tsx`

```tsx
import { motion } from "framer-motion";
import { ReactNode, Children } from "react";

interface FadeInStaggerProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

const FadeInStagger = ({ children, staggerDelay = 0.1, className }: FadeInStaggerProps) => {
  return (
    <motion.div
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className={className}
    >
      {Children.map(children, (child) => (
        <motion.div variants={itemVariants}>{child}</motion.div>
      ))}
    </motion.div>
  );
};

export default FadeInStagger;

```

### `src/components/FooterSection.tsx`

```tsx
import { Facebook, Mail, Phone } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const FooterSection = () => {
  const { t } = useLanguage();

  return (
    <footer className="relative border-t border-white/5 px-4 py-16">
      <div className="absolute left-0 right-0 top-0 h-px bg-[linear-gradient(90deg,transparent,hsla(43,74%,52%,0.6),transparent)] shadow-[0_0_16px_hsla(43,74%,52%,0.24)]" />
      <div className="container mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h3 className="gold-title-gradient font-serif text-3xl font-bold">House of Fades</h3>
            <p className="mt-3 font-body text-sm text-muted-foreground">EST. 2025 — Carlow, Ireland</p>
          </div>
          <div>
            <h4 className="font-body text-xs uppercase tracking-[0.35em] text-accent">{t("footer.quickLinks")}</h4>
            <div className="mt-4 space-y-3 font-body text-sm">
              <a href="#services" className="block text-muted-foreground transition-colors hover:text-accent">{t("nav.services")}</a>
              <a href="#team" className="block text-muted-foreground transition-colors hover:text-accent">{t("nav.team")}</a>
              <a href="#reviews" className="block text-muted-foreground transition-colors hover:text-accent">{t("nav.reviews")}</a>
              <a href="#contact" className="block text-muted-foreground transition-colors hover:text-accent">{t("nav.contact")}</a>
            </div>
          </div>
          <div>
            <h4 className="font-body text-xs uppercase tracking-[0.35em] text-accent">{t("footer.followUs")}</h4>
            <div className="mt-4 flex gap-4">
              <a href="https://www.facebook.com/No6barbershop/#" target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-muted-foreground transition-all hover:border-accent/40 hover:text-accent">
                <Facebook size={18} />
              </a>
              <a href="mailto:jeffkavna@gmail.com" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-muted-foreground transition-all hover:border-accent/40 hover:text-accent">
                <Mail size={18} />
              </a>
              <a href="tel:+353858544561" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-muted-foreground transition-all hover:border-accent/40 hover:text-accent" title="+353 (85) 854 4561">
                <Phone size={18} />
              </a>
            </div>
          </div>
        </div>
        <div className="section-divider my-10" />
        <p className="text-center font-body text-xs text-muted-foreground">© {new Date().getFullYear()} House of Fades. {t("footer.rights")}</p>
      </div>
    </footer>
  );
};

export default FooterSection;

```

### `src/components/GoldLine.tsx`

```tsx
import { useEffect, useRef, useState } from "react";

const GoldLine = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex justify-center mb-6">
      <div
        className="h-[1px] transition-all duration-1000 ease-out"
        style={{
          width: visible ? "80px" : "0px",
          background: "linear-gradient(90deg, transparent, hsl(43, 74%, 52%), transparent)",
        }}
      />
    </div>
  );
};

export default GoldLine;

```

### `src/components/HeroSection.tsx`

```tsx
import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const GoldParticlesCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const particles: { x: number; y: number; speed: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        speed: 0.2 + Math.random() * 0.8,
        size: 1 + Math.random() * 2.5,
        opacity: 0.15 + Math.random() * 0.45,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < -10) {
          p.y = canvas.offsetHeight + 10;
          p.x = Math.random() * canvas.offsetWidth;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${p.opacity})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    const cleanup = draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => {
      cleanup?.();
      window.removeEventListener("resize", handleResize);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none z-0" />;
};

const GoldScissors = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0" style={{ perspective: "1000px" }}>
    <div className="scissors-3d-rotate opacity-10 blur-[0.2px]">
      <svg width="380" height="380" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="25" cy="75" r="12" stroke="#d4af37" strokeWidth="2.5" fill="none" />
        <circle cx="75" cy="75" r="12" stroke="#d4af37" strokeWidth="2.5" fill="none" />
        <line x1="25" y1="63" x2="55" y2="25" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="75" y1="63" x2="45" y2="25" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="42" r="3" fill="#d4af37" />
      </svg>
    </div>
  </div>
);

const HeroSection = ({ onBookNow }: { onBookNow?: () => void }) => {
  const { t } = useLanguage();

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden"
      style={{ background: "radial-gradient(circle at 50% 40%, hsl(var(--card)) 0%, hsl(var(--background)) 55%, hsl(var(--background)) 100%)" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,_hsla(0,68%,33%,0.18),_transparent_35%),radial-gradient(circle_at_right,_hsla(0,68%,33%,0.14),_transparent_30%)]" />
      <GoldParticlesCanvas />
      <GoldScissors />

      <div className="container relative z-10 mx-auto flex min-h-screen items-center px-4 pt-24 pb-12">
        <div className="max-w-4xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: easeOutExpo }}
            className="mb-6 font-body text-xs uppercase tracking-[0.5em] text-accent"
          >
            {t("hero.est")}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.3, ease: easeOutExpo }}
            className="gold-title-gradient max-w-3xl font-serif text-4xl font-bold leading-[0.95] sm:text-5xl md:text-8xl lg:text-[7rem] break-words"
          >
            {t("hero.title")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.65, ease: easeOutExpo }}
            className="mt-8 max-w-xl font-body text-lg leading-relaxed text-foreground/72 md:text-xl"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.95, ease: easeOutExpo }}
            className="mt-10 flex flex-col gap-4 sm:flex-row"
          >
            <motion.button
              onClick={onBookNow}
              whileHover={{ scale: 1.05, boxShadow: "0 0 40px hsla(43, 74%, 52%, 0.32)" }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary-glow btn-book-pulse rounded px-10 py-4 font-body text-sm font-semibold uppercase tracking-[0.05em] text-primary-foreground"
            >
              {t("nav.bookNow")}
            </motion.button>
            <motion.a
              href="#services"
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px hsla(43, 74%, 52%, 0.14)" }}
              whileTap={{ scale: 0.98 }}
              className="btn-gold-outline inline-flex items-center justify-center rounded px-10 py-4 font-body text-sm font-semibold uppercase tracking-[0.05em]"
            >
              {t("hero.exploreServices")}
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

```

### `src/components/HoursLocationSection.tsx`

```tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const HoursLocationSection = () => {
  const [hours, setHours] = useState<{ day: string; time: string }[]>([]);
  const [contact, setContact] = useState<{ address: string; phone: string; email: string }>({ address: "", phone: "", email: "" });
  const { t } = useLanguage();

  useEffect(() => {
    supabase.from("site_content").select("key, value").in("key", ["hours", "contact"]).then(({ data }) => {
      data?.forEach((row) => {
        if (row.key === "hours") setHours(row.value as any);
        if (row.key === "contact") setContact(row.value as any);
      });
    });
  }, []);

  const defaultHours = [
    { day: "Monday", time: "Closed" },
    { day: "Tuesday", time: "09:00 – 18:00" },
    { day: "Wednesday", time: "09:00 – 18:00" },
    { day: "Thursday", time: "09:00 – 17:00" },
    { day: "Friday", time: "09:00 – 18:00" },
    { day: "Saturday", time: "09:00 – 17:00" },
    { day: "Sunday", time: "Closed" },
  ];

  const displayHours = hours.length > 0 ? hours : defaultHours;
  const address = contact.address || "153 Green Ln, Carlow, R93 W354";
  const today = dayNames[new Date().getDay()];
  const todayEntry = displayHours.find((h) => h.day === today);
  const isOpen = todayEntry && todayEntry.time !== "Closed";

  return (
    <section id="contact" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOutExpo }} className="mb-14 max-w-2xl">
          <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">{t("contact.label")}</p>
          <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">{t("contact.title")}</h2>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: easeOutExpo }} className="glass-card rounded-[24px] p-8">
            <div className="mb-6 flex items-center gap-3">
              <Clock size={20} className="text-accent" />
              <h3 className="font-serif text-2xl font-semibold">{t("contact.openingHours")}</h3>
            </div>
            <div className="mb-6 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? "bg-green-500" : "bg-red-500"}`} />
              <span className="font-body text-sm text-muted-foreground">{isOpen ? t("contact.openToday") : t("contact.closedToday")}</span>
            </div>
            <div className="space-y-3 font-body">
              {displayHours.map((h) => {
                const isCurrent = h.day === today;
                return (
                  <div key={h.day} className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm ${isCurrent ? "border border-accent/20 bg-accent/10" : "border border-white/[0.04] bg-white/[0.01]"}`}>
                    <span className={isCurrent ? "font-medium text-accent" : "text-foreground"}>{t(`day.${h.day}`)}</span>
                    <span className={h.time === "Closed" ? "text-primary" : "text-muted-foreground"}>{h.time === "Closed" ? t("contact.closed") : h.time}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1, ease: easeOutExpo }} className="glass-card rounded-[24px] p-8">
            <div className="mb-6 flex items-center gap-3">
              <MapPin size={20} className="text-accent" />
              <h3 className="font-serif text-2xl font-semibold">{t("contact.findUs")}</h3>
            </div>
            <p className="mb-4 font-body text-foreground/86">{address}</p>
            <div className="overflow-hidden rounded-[18px] border border-white/10">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2400.0!2d-6.9261!3d52.8408!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTLCsDUwJzI3LjIiTiA2wrA1NSczMy41Ilc!5e0!3m2!1sen!2sie!4v1"
                width="100%"
                height="280"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="House location"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HoursLocationSection;

```

### `src/components/LanguageSelector.tsx`

```tsx
import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { LANGUAGES, type LangCode } from "@/i18n/translations";

const LanguageSelector = () => {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-foreground/70 hover:text-accent transition-colors duration-300 text-sm font-body tracking-[0.05em]"
        aria-label="Select language"
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{current?.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-white/10 bg-secondary/95 backdrop-blur-xl shadow-xl z-50 py-1 overflow-hidden">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body transition-colors ${
                lang === l.code
                  ? "text-accent bg-accent/10"
                  : "text-foreground/80 hover:text-accent hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;

```

### `src/components/LoadingScreen.tsx`

```tsx
import { useState, useEffect } from "react";

const LoadingScreen = ({ onDone }: { onDone: () => void }) => {
  const [phase, setPhase] = useState<"in" | "out" | "done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 900);
    const t2 = setTimeout(() => {
      setPhase("done");
      onDone();
    }, 1450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transition: "opacity 0.55s ease-out",
      }}
    >
      <h1
        className="gold-title-gradient font-serif text-5xl font-bold tracking-[-0.02em] md:text-7xl"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateY(0)" : "translateY(-16px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >
        House of Fades
      </h1>
    </div>
  );
};

export default LoadingScreen;

```

### `src/components/NavLink.tsx`

```tsx
import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };

```

### `src/components/Navbar.tsx`

```tsx
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

const navLinks = [
  { key: "nav.home", href: "#hero" },
  { key: "nav.services", href: "#services" },
  { key: "nav.team", href: "#team" },
  { key: "nav.reviews", href: "#reviews" },
  { key: "nav.contact", href: "#contact" },
];

const Navbar = ({ onBookNow }: { onBookNow?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-secondary/80 backdrop-blur-xl border-b border-white/[0.06]" : "bg-transparent"}`}>
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <a href="#hero" className="font-serif text-xl tracking-wide gold-shimmer font-bold">
          HOUSE OF FADES
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a key={l.key} href={l.href} className="text-sm font-body text-foreground/70 hover:text-accent transition-colors duration-300 tracking-[0.05em]">
              {t(l.key)}
            </a>
          ))}
          <LanguageSelector />
          <button
            onClick={onBookNow}
            className="btn-primary-glow btn-book-pulse text-primary-foreground px-5 py-2 rounded text-sm font-medium font-body tracking-[0.05em]"
          >
            {t("nav.bookNow")}
          </button>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <LanguageSelector />
          <button className="text-foreground" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-secondary/90 backdrop-blur-xl border-t border-white/[0.06] px-4 pb-4">
          {navLinks.map((l) => (
            <a key={l.key} href={l.href} className="block py-3 text-foreground hover:text-accent transition-colors font-body tracking-[0.05em]" onClick={() => setOpen(false)}>
              {t(l.key)}
            </a>
          ))}
          <button
            onClick={() => { setOpen(false); onBookNow?.(); }}
            className="block w-full mt-2 btn-primary-glow btn-book-pulse text-primary-foreground px-5 py-2 rounded text-sm font-medium text-center font-body tracking-[0.05em]"
          >
            {t("nav.bookNow")}
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

```

### `src/components/ReviewsSection.tsx`

```tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const placeholderReviews = [
  { author: "Liam K.", text: "Best fade in Carlow, hands down. Always leave looking sharp.", rating: 5 },
  { author: "Darren O.", text: "Brilliant barbers, great atmosphere. Wouldn't go anywhere else.", rating: 5 },
];

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const ReviewsSection = () => {
  const [reviews, setReviews] = useState<{ author: string; text: string; rating: number }[]>([]);
  const [idx, setIdx] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    supabase.from("reviews").select("author, text, rating").order("created_at").then(({ data }) => {
      const combined = [...(data || []), ...placeholderReviews];
      setReviews(combined);
    });
  }, []);

  const prev = () => setIdx((i) => (i === 0 ? reviews.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === reviews.length - 1 ? 0 : i + 1));

  if (reviews.length === 0) return null;

  return (
    <section id="reviews" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOutExpo }} className="mb-12">
          <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">{t("reviews.label")}</p>
          <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">{t("reviews.title")}</h2>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: easeOutExpo }}
            className="glass-card rounded-[24px] px-8 py-10 md:px-12 md:py-14"
          >
            <div className="mb-6 flex justify-center gap-1">
              {[...Array(reviews[idx].rating)].map((_, i) => (
                <Star key={i} size={20} className="fill-accent text-accent" />
              ))}
            </div>
            <p className="font-serif text-2xl leading-relaxed text-foreground md:text-3xl">"{reviews[idx].text}"</p>
            <p className="mt-6 font-body text-sm uppercase tracking-[0.2em] text-muted-foreground">{reviews[idx].author}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex justify-center gap-4">
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }} onClick={prev} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-foreground transition-all duration-300 hover:border-accent/40 hover:text-accent">
            <ChevronLeft size={20} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }} onClick={next} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-foreground transition-all duration-300 hover:border-accent/40 hover:text-accent">
            <ChevronRight size={20} />
          </motion.button>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;

```

### `src/components/ScrollReveal.tsx`

```tsx
import { useEffect, useRef, useState, ReactNode } from "react";

const ScrollReveal = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="transition-all duration-1000"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(36px)",
        transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;

```

### `src/components/SectionDivider.tsx`

```tsx
const SectionDivider = () => (
  <div className="section-divider mx-auto max-w-4xl" />
);

export default SectionDivider;

```

### `src/components/ServicesSection.tsx`

```tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import FadeInStagger from "./FadeInStagger";

type Service = { id: string; name: string; duration_minutes: number; price: number };
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const ServicesSection = ({ onBookNow }: { onBookNow?: () => void }) => {
  const [services, setServices] = useState<Service[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    supabase.from("services").select("id, name, duration_minutes, price").order("created_at").then(({ data }) => {
      if (data) setServices(data);
    });
  }, []);

  return (
    <section id="services" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: easeOutExpo }}
          className="mb-16 max-w-2xl"
        >
          <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">{t("services.label")}</p>
          <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">{t("services.title")}</h2>
        </motion.div>

        <FadeInStagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <motion.div
              key={s.id}
              onClick={onBookNow}
              whileHover={{ y: -8, scale: 1.01, boxShadow: "0 20px 60px hsla(43, 74%, 52%, 0.12)" }}
              transition={{ duration: 0.3 }}
              className="glass-card card-shimmer-border cursor-pointer rounded-lg p-7"
            >
              <div className="mb-8 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
                  <Scissors size={18} className="text-accent" />
                </div>
                <span className="font-serif text-2xl font-bold text-accent">€{Number(s.price).toFixed(0)}</span>
              </div>

              <h3 className="font-serif text-2xl font-semibold text-foreground">{s.name}</h3>
              <div className="mt-3 flex items-center gap-2 font-body text-sm text-muted-foreground">
                <Clock size={14} />
                <span>{s.duration_minutes} {t("services.min")}</span>
              </div>
            </motion.div>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
};

export default ServicesSection;

```

### `src/components/TeamSection.tsx`

```tsx
import { motion } from "framer-motion";
import { Scissors } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import FadeInStagger from "./FadeInStagger";

const team = [
  { name: "John", role: "Senior Barber" },
  { name: "Mario", role: "Style Specialist" },
  { name: "CJ", role: "Fade Expert" },
];

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const TeamSection = ({ onBookWithBarber }: { onBookWithBarber?: (name: string) => void }) => {
  const { t } = useLanguage();

  return (
    <section id="team" className="px-4 py-20 md:py-[120px]">
      <div className="container mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOutExpo }} className="mb-16 text-center">
          <p className="mb-4 font-body text-xs uppercase tracking-[0.45em] text-accent">{t("team.label")}</p>
          <h2 className="gold-title-gradient font-serif text-4xl font-bold md:text-5xl">{t("team.title")}</h2>
        </motion.div>

        <FadeInStagger className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {team.map((member) => (
            <div key={member.name} className="glass-card rounded-[20px] p-8 text-center transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_70px_hsla(43,74%,52%,0.12)]">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                <Scissors size={30} className="text-accent" />
              </div>
              <h3 className="font-serif text-3xl font-semibold text-foreground">{member.name}</h3>
              <p className="mt-2 font-body text-sm text-muted-foreground">{member.role}</p>
              <motion.button
                onClick={() => onBookWithBarber?.(member.name)}
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px hsla(43, 74%, 52%, 0.18)" }}
                whileTap={{ scale: 0.98 }}
                className="btn-gold-outline mt-8 inline-flex rounded px-6 py-3 font-body text-xs font-semibold uppercase tracking-[0.05em]"
              >
                {t("team.bookWith")} {member.name}
              </motion.button>
            </div>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
};

export default TeamSection;

```

### `src/components/WaitingListForm.tsx`

```tsx
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ClipboardList, Check } from "lucide-react";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import CountryCodeSelector, { COUNTRIES, formatPhoneForSubmit, type Country } from "@/components/CountryCodeSelector";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

interface WaitingListFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  barberId: string;
  barberName: string;
}

const WaitingListForm = ({ open, onOpenChange, date, barberId, barberName }: WaitingListFormProps) => {
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { t } = useLanguage();

  const dateStr = format(date, "yyyy-MM-dd");

  useEffect(() => {
    if (!open) return;
    supabase
      .from("waiting_list")
      .select("time_slot")
      .eq("barber_id", barberId)
      .eq("appointment_date", dateStr)
      .in("status", ["pending", "notified"])
      .then(({ data }) => {
        if (data) setTakenSlots(data.map(d => (d.time_slot as string).slice(0, 5)));
      });
  }, [open, barberId, dateStr]);

  const reset = () => {
    setSelectedTime("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setSuccess(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) { toast.error(t("booking.enterName")); return; }
    if (!clientEmail.trim()) { toast.error(t("booking.enterEmail")); return; }
    if (!selectedTime) { toast.error("Please select a time slot"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("waiting_list").insert({
      appointment_date: dateStr,
      time_slot: selectedTime,
      barber_id: barberId,
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      client_phone: clientPhone.trim() ? formatPhoneForSubmit(clientPhone, selectedCountry) : null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Error joining waiting list. Please try again.");
      console.error(error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-card border-accent/20 text-foreground max-w-md mx-auto">
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={32} className="text-[#4A7C2F]" />
            </div>
            <p className="font-body text-foreground font-medium">
              You're on the waiting list for {format(date, "dd/MM/yyyy")} at {selectedTime}.
            </p>
            <p className="font-body text-muted-foreground text-sm">
              We'll email and text you the moment a slot opens!
            </p>
            <Button onClick={() => handleClose(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-body mt-4">
              {t("booking.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-accent/20 text-foreground max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl gold-title-gradient flex items-center gap-2">
            <ClipboardList size={24} /> Join Waiting List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            All slots for {barberName} on {format(date, "dd/MM/yyyy")} are booked. Join the waiting list and we'll notify you when a slot opens!
          </p>

          <div>
            <p className="font-body text-sm text-muted-foreground mb-2">Choose desired time slot:</p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map(tm => {
                const taken = takenSlots.includes(tm);
                return (
                  <button
                    key={tm}
                    disabled={taken}
                    onClick={() => setSelectedTime(tm)}
                    className={cn(
                      "py-2 rounded text-sm font-body transition-all border",
                      taken
                        ? "border-border text-muted-foreground/40 cursor-not-allowed line-through bg-muted/20"
                        : selectedTime === tm
                          ? "border-accent bg-accent/20 text-foreground"
                          : "border-border hover:border-accent/50 text-foreground"
                    )}
                  >
                    {tm}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Input
              placeholder={t("booking.name")}
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              className="bg-background border-border text-foreground font-body"
            />
            <Input
              placeholder={t("booking.email")}
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              className="bg-background border-border text-foreground font-body"
            />
            <div className="flex">
              <CountryCodeSelector selected={selectedCountry} onSelect={setSelectedCountry} />
              <Input
                placeholder={selectedCountry.code === "IE" ? "085 123 4567" : t("booking.phone")}
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="bg-background border-border text-foreground font-body rounded-l-none"
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !clientName.trim() || !clientEmail.trim() || !selectedTime}
            className="w-full bg-accent hover:bg-accent/90 text-background font-body"
          >
            {submitting ? "Joining..." : "📋 Join Waiting List"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WaitingListForm;

```

### `src/components/admin/AdminLogin.tsx`

```tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold mb-2">House</h1>
          <p className="text-muted-foreground font-body text-sm">Admin Portal</p>
        </div>
        <form onSubmit={handleLogin} className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div>
            <Label htmlFor="admin-email" className="text-foreground font-body text-sm">Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 bg-background border-border text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="admin-password" className="text-foreground font-body text-sm">Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 bg-background border-border text-foreground"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

```

### `src/components/admin/EditBarberViewTab.tsx`

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Key, Download, Calendar, X, Check } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth, eachDayOfInterval, endOfWeek, subMonths } from "date-fns";

type Barber = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  commission_rate: number;
  photo_url: string | null;
  bio: string | null;
};

type AppointmentRow = {
  id: string;
  barber_id: string;
  appointment_date: string;
  time_slot: string;
  status: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  notes: string | null;
  services: { name: string; price: number } | null;
  barbers: { name: string; commission_rate: number } | null;
};

// Barber Management
const BarberManagement = () => {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee", commission_rate: 0.50 });
  const [loading, setLoading] = useState(false);

  const fetchBarbers = async () => {
    const { data } = await supabase.from("barbers").select("*").order("name");
    if (data) setBarbers(data as Barber[]);
  };

  useEffect(() => { fetchBarbers(); }, []);

  const createBarber = async () => {
    if (!form.name || !form.email || !form.password) { toast.error("Fill all fields"); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "create-barber", ...form },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || "Failed to create barber");
    } else {
      toast.success("Barber created!");
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "employee", commission_rate: 0.50 });
      fetchBarbers();
    }
  };

  const deleteBarber = async (userId: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "delete-barber", userId },
    });
    if (error || data?.error) toast.error("Failed to delete");
    else { toast.success("Deleted!"); fetchBarbers(); }
  };

  const updateCommission = async (id: string, rate: number) => {
    await supabase.from("barbers").update({ commission_rate: rate }).eq("id", id);
    toast.success("Commission updated!");
    fetchBarbers();
  };

  const resetPassword = async (userId: string) => {
    const newPass = prompt("Enter new password (min 6 chars):");
    if (!newPass || newPass.length < 6) return;
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "update-barber-password", userId, password: newPass },
    });
    if (error || data?.error) toast.error("Failed");
    else toast.success("Password updated!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold">Barber Accounts</h3>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-accent text-accent-foreground hover:bg-accent/80">
          <Plus size={16} className="mr-1" /> Add Barber
        </Button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground font-body text-sm">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Role</Label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm">
                <option value="employee">Employee</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Commission %</Label>
              <Input type="number" step="0.01" min="0" max="1" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0.5 })} className="mt-1 bg-background border-border text-foreground" />
            </div>
          </div>
          <Button onClick={createBarber} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/80">
            {loading ? "Creating…" : "Create Barber"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {barbers.map((b) => (
          <div key={b.id} className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-foreground font-body font-medium">{b.name}</p>
              <p className="text-muted-foreground font-body text-sm">{b.email} • {b.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs font-body">Commission:</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  defaultValue={b.commission_rate}
                  onBlur={(e) => updateCommission(b.id, parseFloat(e.target.value))}
                  className="w-20 bg-background border-border text-foreground text-sm"
                />
              </div>
              <Button size="sm" variant="ghost" onClick={() => resetPassword(b.user_id)} className="text-foreground"><Key size={14} /></Button>
              <Button size="sm" variant="ghost" onClick={() => deleteBarber(b.user_id, b.name)} className="text-primary"><Trash2 size={14} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Shop Stats
const ShopStats = () => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, services(name, price), barbers(name, commission_rate)")
        .eq("status", "completed");
      if (data) setAppointments(data as AppointmentRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <p className="text-muted-foreground font-body">Loading…</p>;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const barberNames = [...new Set(appointments.map((a) => a.barbers?.name || "Unknown"))];
  const totalRevenue = appointments.reduce((s, a) => s + (a.services?.price || 0), 0);

  // Find busiest day and time
  const dayCount: Record<string, number> = {};
  const timeCount: Record<string, number> = {};
  appointments.forEach((a) => {
    const dayName = format(parseISO(a.appointment_date), "EEEE");
    dayCount[dayName] = (dayCount[dayName] || 0) + 1;
    const hour = a.time_slot.slice(0, 5);
    timeCount[hour] = (timeCount[hour] || 0) + 1;
  });
  const busiestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
  const busiestTime = Object.entries(timeCount).sort((a, b) => b[1] - a[1])[0];

  const perBarber = barberNames.map((name) => {
    const mine = appointments.filter((a) => a.barbers?.name === name);
    const commission = mine[0]?.barbers?.commission_rate || 0.5;
    const revenue = mine.reduce((s, a) => s + (a.services?.price || 0), 0);
    return { name, cuts: mine.length, revenue, earnings: revenue * commission, commission };
  });

  // Charts
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: endOfWeek(now, { weekStartsOn: 1 }) });
  const dailyData = daysOfWeek.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const entry: Record<string, string | number> = { day: format(day, "EEE") };
    barberNames.forEach((name) => {
      entry[name] = appointments.filter((a) => a.appointment_date === dayStr && a.barbers?.name === name).length;
    });
    return entry;
  });

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(now, 5 - i);
    const mStr = format(m, "yyyy-MM");
    const entry: Record<string, string | number> = { month: format(m, "MMM") };
    barberNames.forEach((name) => {
      const mine = appointments.filter((a) => a.appointment_date.startsWith(mStr) && a.barbers?.name === name);
      const commission = mine[0]?.barbers?.commission_rate || 0.5;
      entry[name] = Math.round(mine.reduce((s, a) => s + (a.services?.price || 0), 0) * commission);
    });
    return entry;
  });

  const colors = ["#8B1A1A", "#4A7C2F", "#C4A35A"];

  const exportCSV = () => {
    const headers = "Barber,Cuts,Revenue,Earnings,Commission\n";
    const rows = perBarber.map((b) => `${b.name},${b.cuts},€${b.revenue.toFixed(2)},€${b.earnings.toFixed(2)},${(b.commission * 100).toFixed(0)}%`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shop-stats-${format(now, "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold">Shop Statistics</h3>
        <Button size="sm" onClick={exportCSV} className="bg-primary text-primary-foreground hover:bg-primary/80">
          <Download size={16} className="mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`€${totalRevenue.toFixed(0)}`} sub="all time" />
        <StatCard label="Total Cuts" value={appointments.length} sub="all time" />
        <StatCard label="Busiest Day" value={busiestDay?.[0] || "—"} sub={`${busiestDay?.[1] || 0} cuts`} />
        <StatCard label="Busiest Time" value={busiestTime?.[0] || "—"} sub={`${busiestTime?.[1] || 0} cuts`} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {perBarber.map((b) => (
          <div key={b.name} className="bg-card border border-border rounded-lg p-4">
            <h4 className="font-serif text-lg font-bold mb-2">{b.name}</h4>
            <div className="grid grid-cols-2 gap-1 font-body text-sm">
              <span className="text-muted-foreground">Cuts:</span><span className="text-foreground">{b.cuts}</span>
              <span className="text-muted-foreground">Revenue:</span><span className="text-foreground">€{b.revenue.toFixed(0)}</span>
              <span className="text-muted-foreground">Commission:</span><span className="text-foreground">{(b.commission * 100).toFixed(0)}%</span>
              <span className="text-muted-foreground">Earnings:</span><span className="text-accent font-medium">€{b.earnings.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Bar Chart */}
      <div>
        <h4 className="font-serif text-lg font-semibold mb-3">Revenue Per Day (This Week)</h4>
        <div className="bg-card border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" stroke="#999" fontSize={12} />
              <YAxis stroke="#999" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#242424", border: "1px solid #333", color: "#F5F5F5" }} />
              <Legend />
              {barberNames.map((name, i) => <Bar key={name} dataKey={name} fill={colors[i % colors.length]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Earnings Line Chart */}
      <div>
        <h4 className="font-serif text-lg font-semibold mb-3">Monthly Earnings (6 Months)</h4>
        <div className="bg-card border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#999" fontSize={12} />
              <YAxis stroke="#999" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#242424", border: "1px solid #333", color: "#F5F5F5" }} />
              <Legend />
              {barberNames.map((name, i) => <Line key={name} type="monotone" dataKey={name} stroke={colors[i % colors.length]} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Master Calendar
const MasterCalendar = () => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [barbers, setBarbers] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; price: number }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newAppt, setNewAppt] = useState({ barber_id: "", service_id: "", client_name: "", client_email: "", client_phone: "", time_slot: "09:00" });

  const fetchAll = async () => {
    const [{ data: appts }, { data: b }, { data: s }] = await Promise.all([
      supabase.from("appointments").select("*, services(name, price), barbers(name, commission_rate)").eq("appointment_date", selectedDate).order("time_slot"),
      supabase.from("barbers").select("id, name"),
      supabase.from("services").select("id, name, price"),
    ]);
    if (appts) setAppointments(appts as AppointmentRow[]);
    if (b) setBarbers(b);
    if (s) setServices(s);
  };

  useEffect(() => { fetchAll(); }, [selectedDate]);

  const cancelAppt = async (id: string) => {
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    toast.success("Cancelled");
    fetchAll();
  };

  const completeAppt = async (id: string) => {
    await supabase.from("appointments").update({ status: "completed" }).eq("id", id);
    toast.success("Completed");
    fetchAll();
  };

  const addAppt = async () => {
    if (!newAppt.barber_id || !newAppt.service_id || !newAppt.client_name) { toast.error("Fill required fields"); return; }
    const { error } = await supabase.from("appointments").insert({
      ...newAppt,
      appointment_date: selectedDate,
      time_slot: newAppt.time_slot + ":00",
    });
    if (error) toast.error(error.message);
    else { toast.success("Appointment added!"); setShowAdd(false); fetchAll(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-serif text-xl font-semibold flex items-center gap-2">
          <Calendar size={20} className="text-primary" /> Master Calendar
        </h3>
        <div className="flex gap-2">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-background border-border text-foreground" />
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-accent text-accent-foreground hover:bg-accent/80">
            <Plus size={16} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground font-body text-sm">Barber</Label>
              <select value={newAppt.barber_id} onChange={(e) => setNewAppt({ ...newAppt, barber_id: e.target.value })} className="mt-1 w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm">
                <option value="">Select…</option>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Service</Label>
              <select value={newAppt.service_id} onChange={(e) => setNewAppt({ ...newAppt, service_id: e.target.value })} className="mt-1 w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm">
                <option value="">Select…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} — €{s.price}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Client Name</Label>
              <Input value={newAppt.client_name} onChange={(e) => setNewAppt({ ...newAppt, client_name: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Time</Label>
              <Input type="time" value={newAppt.time_slot} onChange={(e) => setNewAppt({ ...newAppt, time_slot: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Email</Label>
              <Input value={newAppt.client_email} onChange={(e) => setNewAppt({ ...newAppt, client_email: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground font-body text-sm">Phone</Label>
              <Input value={newAppt.client_phone} onChange={(e) => setNewAppt({ ...newAppt, client_phone: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
            </div>
          </div>
          <Button onClick={addAppt} className="bg-accent text-accent-foreground hover:bg-accent/80">Add Appointment</Button>
        </div>
      )}

      <div className="space-y-2">
        {appointments.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm py-8 text-center">No appointments for this date.</p>
        ) : (
          appointments.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-body">
                  <span className="text-foreground font-medium">{a.time_slot.slice(0, 5)}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-foreground">{a.barbers?.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    a.status === "booked" ? "bg-accent/20 text-accent" :
                    a.status === "completed" ? "bg-accent text-accent-foreground" :
                    a.status === "cancelled" ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>{a.status}</span>
                </div>
                <p className="text-foreground font-body text-sm">{a.client_name} — {a.services?.name}</p>
              </div>
              {a.status === "booked" && (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => completeAppt(a.id)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Check size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => cancelAppt(a.id)} className="text-primary"><X size={14} /></Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub: string }) => (
  <div className="bg-card border border-border rounded-lg p-4 text-center">
    <p className="text-muted-foreground font-body text-xs uppercase tracking-wider">{label}</p>
    <p className="font-serif text-2xl font-bold mt-1">{value}</p>
    <p className="text-muted-foreground font-body text-xs">{sub}</p>
  </div>
);

// Main Tab
const EditBarberViewTab = () => {
  return (
    <div className="space-y-10">
      <BarberManagement />
      <hr className="border-border" />
      <ShopStats />
      <hr className="border-border" />
      <MasterCalendar />
    </div>
  );
};

export default EditBarberViewTab;

```

### `src/components/admin/EditClientViewTab.tsx`

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Upload, Plus, Trash2, Pencil } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

type SiteContent = Record<string, any>;

const useContent = (key: string) => {
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", key).maybeSingle().then(({ data }) => {
      if (data) setValue(data.value);
      setLoading(false);
    });
  }, [key]);

  const save = async (newVal: any) => {
    const { error } = await supabase.from("site_content").update({ value: newVal as Json }).eq("key", key);
    if (error) toast.error("Failed to save");
    else { setValue(newVal); toast.success("Saved!"); }
  };

  return { value, loading, save };
};

// Hero Editor
const HeroEditor = () => {
  const { value: hero, loading, save } = useContent("hero");
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (hero) setForm(hero); }, [hero]);

  if (loading) return <p className="text-muted-foreground font-body">Loading…</p>;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `hero/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data: { publicUrl } } = supabase.storage.from("site-assets").getPublicUrl(path);
    const updated = { ...form, [field]: publicUrl };
    setForm(updated);
    save(updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Hero Section</h3>
      <div>
        <Label className="text-foreground font-body text-sm">Tagline</Label>
        <Input value={form.tagline || ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Button Text</Label>
        <Input value={form.buttonText || ""} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Button Colour</Label>
        <Input type="color" value={form.buttonColor || "#8B1A1A"} onChange={(e) => setForm({ ...form, buttonColor: e.target.value })} className="mt-1 w-20 h-10 bg-background border-border" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Hero Background Image</Label>
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "heroImageUrl")} className="mt-1 text-foreground font-body text-sm" />
        {form.heroImageUrl && <img src={form.heroImageUrl} alt="Hero" className="mt-2 h-24 rounded object-cover" />}
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Logo Image</Label>
        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "logoUrl")} className="mt-1 text-foreground font-body text-sm" />
        {form.logoUrl && <img src={form.logoUrl} alt="Logo" className="mt-2 h-16 object-contain" />}
      </div>
      <Button onClick={() => save(form)} className="bg-accent text-accent-foreground hover:bg-accent/80">
        <Save size={16} className="mr-1.5" /> Save Hero
      </Button>
    </div>
  );
};

// Services Editor
const ServicesEditor = () => {
  const [services, setServices] = useState<any[]>([]);
  const [newService, setNewService] = useState({ name: "", duration_minutes: 20, price: 0 });

  const fetch = async () => {
    const { data } = await supabase.from("services").select("*").order("created_at");
    if (data) setServices(data);
  };

  useEffect(() => { fetch(); }, []);

  const addService = async () => {
    if (!newService.name) return;
    const { error } = await supabase.from("services").insert(newService);
    if (error) toast.error(error.message);
    else { toast.success("Added!"); setNewService({ name: "", duration_minutes: 20, price: 0 }); fetch(); }
  };

  const updateService = async (id: string, updates: any) => {
    await supabase.from("services").update(updates).eq("id", id);
    toast.success("Updated!");
    fetch();
  };

  const deleteService = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    toast.success("Deleted!");
    fetch();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Services</h3>
      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.id} className="bg-card border border-border rounded-lg p-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <Input defaultValue={s.name} onBlur={(e) => updateService(s.id, { name: e.target.value })} className="flex-1 bg-background border-border text-foreground text-sm" />
            <Input type="number" defaultValue={s.duration_minutes} onBlur={(e) => updateService(s.id, { duration_minutes: parseInt(e.target.value) })} className="w-20 bg-background border-border text-foreground text-sm" />
            <div className="flex items-center gap-1">
              <span className="text-foreground text-sm">€</span>
              <Input type="number" step="0.01" defaultValue={s.price} onBlur={(e) => updateService(s.id, { price: parseFloat(e.target.value) })} className="w-20 bg-background border-border text-foreground text-sm" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => deleteService(s.id)} className="text-primary hover:text-primary/80"><Trash2 size={16} /></Button>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 bg-card border border-border rounded-lg p-3">
        <Input placeholder="Service name" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} className="flex-1 bg-background border-border text-foreground text-sm" />
        <Input type="number" placeholder="Min" value={newService.duration_minutes} onChange={(e) => setNewService({ ...newService, duration_minutes: parseInt(e.target.value) || 20 })} className="w-20 bg-background border-border text-foreground text-sm" />
        <Input type="number" step="0.01" placeholder="€" value={newService.price || ""} onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) || 0 })} className="w-20 bg-background border-border text-foreground text-sm" />
        <Button size="sm" onClick={addService} className="bg-accent text-accent-foreground hover:bg-accent/80"><Plus size={16} className="mr-1" /> Add</Button>
      </div>
    </div>
  );
};

// Reviews Editor
const ReviewsEditor = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [newReview, setNewReview] = useState({ author: "", text: "", rating: 5 });

  const fetch = async () => {
    const { data } = await supabase.from("reviews").select("*").order("created_at");
    if (data) setReviews(data);
  };

  useEffect(() => { fetch(); }, []);

  const addReview = async () => {
    if (!newReview.author || !newReview.text) return;
    await supabase.from("reviews").insert(newReview);
    toast.success("Added!");
    setNewReview({ author: "", text: "", rating: 5 });
    fetch();
  };

  const deleteReview = async (id: string) => {
    await supabase.from("reviews").delete().eq("id", id);
    toast.success("Deleted!");
    fetch();
  };

  const updateReview = async (id: string, updates: any) => {
    await supabase.from("reviews").update(updates).eq("id", id);
    toast.success("Updated!");
    fetch();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Reviews</h3>
      <div className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <Input defaultValue={r.author} onBlur={(e) => updateReview(r.id, { author: e.target.value })} className="w-32 bg-background border-border text-foreground text-sm" placeholder="Author" />
              <Input type="number" min={1} max={5} defaultValue={r.rating} onBlur={(e) => updateReview(r.id, { rating: parseInt(e.target.value) })} className="w-16 bg-background border-border text-foreground text-sm" />
              <Button size="sm" variant="ghost" onClick={() => deleteReview(r.id)} className="text-primary hover:text-primary/80"><Trash2 size={16} /></Button>
            </div>
            <Textarea defaultValue={r.text} onBlur={(e) => updateReview(r.id, { text: e.target.value })} className="bg-background border-border text-foreground text-sm" rows={2} />
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
          <Input placeholder="Author" value={newReview.author} onChange={(e) => setNewReview({ ...newReview, author: e.target.value })} className="flex-1 bg-background border-border text-foreground text-sm" />
          <Input type="number" min={1} max={5} value={newReview.rating} onChange={(e) => setNewReview({ ...newReview, rating: parseInt(e.target.value) || 5 })} className="w-16 bg-background border-border text-foreground text-sm" />
        </div>
        <Textarea placeholder="Review text" value={newReview.text} onChange={(e) => setNewReview({ ...newReview, text: e.target.value })} className="bg-background border-border text-foreground text-sm" rows={2} />
        <Button size="sm" onClick={addReview} className="bg-accent text-accent-foreground hover:bg-accent/80"><Plus size={16} className="mr-1" /> Add Review</Button>
      </div>
    </div>
  );
};

// About Editor
const AboutEditor = () => {
  const { value: about, loading, save } = useContent("about");
  const [text, setText] = useState("");

  useEffect(() => { if (about) setText(about.text || ""); }, [about]);
  if (loading) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">About Section</h3>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="bg-background border-border text-foreground" rows={4} />
      <Button onClick={() => save({ text })} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save</Button>
    </div>
  );
};

// Hours Editor
const HoursEditor = () => {
  const { value: hours, loading, save } = useContent("hours");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { if (hours) setItems(hours); }, [hours]);
  if (loading) return null;

  const update = (idx: number, field: string, val: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    setItems(updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Opening Hours</h3>
      <div className="space-y-2">
        {items.map((h: any, i: number) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-foreground font-body text-sm w-28">{h.day}</span>
            <Input value={h.time} onChange={(e) => update(i, "time", e.target.value)} className="flex-1 bg-background border-border text-foreground text-sm" />
          </div>
        ))}
      </div>
      <Button onClick={() => save(items)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save Hours</Button>
    </div>
  );
};

// Contact Editor
const ContactEditor = () => {
  const { value: contact, loading, save } = useContent("contact");
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (contact) setForm(contact); }, [contact]);
  if (loading) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Contact Info</h3>
      <div>
        <Label className="text-foreground font-body text-sm">Address</Label>
        <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Phone</Label>
        <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Email</Label>
        <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <Button onClick={() => save(form)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save</Button>
    </div>
  );
};

// Footer Editor
const FooterEditor = () => {
  const { value: footer, loading, save } = useContent("footer");
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (footer) setForm(footer); }, [footer]);
  if (loading) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Footer</h3>
      <div>
        <Label className="text-foreground font-body text-sm">Footer Text</Label>
        <Input value={form.text || ""} onChange={(e) => setForm({ ...form, text: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Instagram URL</Label>
        <Input value={form.instagram || ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Facebook URL</Label>
        <Input value={form.facebook || ""} onChange={(e) => setForm({ ...form, facebook: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <div>
        <Label className="text-foreground font-body text-sm">Phone</Label>
        <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-background border-border text-foreground" />
      </div>
      <Button onClick={() => save(form)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save</Button>
    </div>
  );
};

// Design Editor (Font + Colors)
const DesignEditor = () => {
  const { value: design, loading, save } = useContent("design");
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (design) setForm(design); }, [design]);
  if (loading) return null;

  const fonts = ["Playfair Display", "Merriweather", "Lora", "Cormorant Garamond", "Libre Baskerville"];

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl font-semibold">Design Settings</h3>
      <div>
        <Label className="text-foreground font-body text-sm">Heading Font</Label>
        <select
          value={form.font || "Playfair Display"}
          onChange={(e) => setForm({ ...form, font: e.target.value })}
          className="mt-1 w-full bg-background border border-border text-foreground rounded-md px-3 py-2 font-body text-sm"
        >
          {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Primary Colour", key: "primaryColor" },
          { label: "Accent Colour", key: "accentColor" },
          { label: "Background Colour", key: "backgroundColor" },
          { label: "Text Colour", key: "textColor" },
        ].map(({ label, key }) => (
          <div key={key}>
            <Label className="text-foreground font-body text-sm">{label}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="color" value={form[key] || "#000"} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-10 h-10 p-0 bg-background border-border" />
              <Input value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="flex-1 bg-background border-border text-foreground text-sm" />
            </div>
          </div>
        ))}
      </div>
      <Button onClick={() => save(form)} className="bg-accent text-accent-foreground hover:bg-accent/80"><Save size={16} className="mr-1.5" /> Save Design</Button>
    </div>
  );
};

// Main CMS Tab
const EditClientViewTab = () => {
  return (
    <div className="space-y-10">
      <HeroEditor />
      <hr className="border-border" />
      <ServicesEditor />
      <hr className="border-border" />
      <ReviewsEditor />
      <hr className="border-border" />
      <AboutEditor />
      <hr className="border-border" />
      <HoursEditor />
      <hr className="border-border" />
      <ContactEditor />
      <hr className="border-border" />
      <FooterEditor />
      <hr className="border-border" />
      <DesignEditor />
    </div>
  );
};

export default EditClientViewTab;

```

### `src/components/barber/BarberLogin.tsx`

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const BarberLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/barber");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold mb-2">House</h1>
          <p className="text-muted-foreground font-body text-sm">Barber Portal</p>
        </div>
        <form onSubmit={handleLogin} className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div>
            <Label htmlFor="email" className="text-foreground font-body text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 bg-background border-border text-foreground"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-foreground font-body text-sm">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 bg-background border-border text-foreground"
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/80"
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BarberLogin;

```

### `src/components/barber/EmployeeStatsTab.tsx`

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, parseISO } from "date-fns";

const COMMISSION = 0.5;

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  services: { name: string; price: number } | null;
};

const EmployeeStatsTab = ({ barberId }: { barberId: string }) => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, services(name, price)")
        .eq("barber_id", barberId)
        .eq("status", "completed");
      if (data) setAppointments(data as AppointmentRow[]);
      setLoading(false);
    };
    fetch();
  }, [barberId]);

  if (loading) return <p className="text-muted-foreground font-body p-4">Loading stats…</p>;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const weekAppts = appointments.filter((a) => parseISO(a.appointment_date) >= weekStart);
  const monthAppts = appointments.filter((a) => parseISO(a.appointment_date) >= monthStart);
  const totalRevenue = appointments.reduce((s, a) => s + (a.services?.price || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Week" value={weekAppts.length} sub="cuts" />
        <StatCard label="This Month" value={monthAppts.length} sub="cuts" />
        <StatCard label="All Time" value={appointments.length} sub="cuts" />
        <StatCard label="My Earnings" value={`€${(totalRevenue * COMMISSION).toFixed(0)}`} sub="all time (50%)" />
      </div>

      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Service Breakdown</h3>
        <div className="space-y-2">
          {(() => {
            const serviceMap = new Map<string, { count: number; revenue: number }>();
            appointments.forEach((a) => {
              const sn = a.services?.name || "Unknown";
              const existing = serviceMap.get(sn) || { count: 0, revenue: 0 };
              serviceMap.set(sn, { count: existing.count + 1, revenue: existing.revenue + (a.services?.price || 0) });
            });
            return Array.from(serviceMap.entries()).map(([service, data]) => (
              <div key={service} className="bg-card border border-border rounded-lg p-3 flex justify-between items-center font-body text-sm">
                <span className="text-foreground">{service}</span>
                <div className="text-right">
                  <span className="text-muted-foreground">{data.count} cuts</span>
                  <span className="text-foreground ml-3">€{(data.revenue * COMMISSION).toFixed(0)}</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub: string }) => (
  <div className="bg-card border border-border rounded-lg p-4 text-center">
    <p className="text-muted-foreground font-body text-xs uppercase tracking-wider">{label}</p>
    <p className="font-serif text-2xl font-bold mt-1">{value}</p>
    <p className="text-muted-foreground font-body text-xs">{sub}</p>
  </div>
);

export default EmployeeStatsTab;

```

### `src/components/barber/OwnerStatsTab.tsx`

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { startOfWeek, startOfMonth, format, parseISO, subMonths, eachDayOfInterval, endOfWeek } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

const COMMISSION = 0.5;

type AppointmentRow = {
  id: string;
  barber_id: string;
  appointment_date: string;
  status: string;
  services: { name: string; price: number } | null;
  barbers: { name: string } | null;
};

const OwnerStatsTab = () => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifEmail, setNotifEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    supabase
      .from("owner_settings" as any)
      .select("value")
      .eq("key", "notification_email")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.value) setNotifEmail(data.value);
      });
  }, []);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, barber_id, appointment_date, status, services(name, price), barbers(name)")
        .eq("status", "completed");
      if (data) setAppointments(data as AppointmentRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <p className="text-muted-foreground font-body p-4">Loading stats…</p>;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const weekAppts = appointments.filter((a) => parseISO(a.appointment_date) >= weekStart);
  const monthAppts = appointments.filter((a) => parseISO(a.appointment_date) >= monthStart);

  // Per-barber stats
  const barberNames = [...new Set(appointments.map((a) => a.barbers?.name || "Unknown"))];

  const perBarber = barberNames.map((name) => {
    const mine = appointments.filter((a) => a.barbers?.name === name);
    const weekMine = mine.filter((a) => parseISO(a.appointment_date) >= weekStart);
    const monthMine = mine.filter((a) => parseISO(a.appointment_date) >= monthStart);
    const totalRevenue = mine.reduce((s, a) => s + (a.services?.price || 0), 0);
    return {
      name,
      weekCuts: weekMine.length,
      monthCuts: monthMine.length,
      allTimeCuts: mine.length,
      totalRevenue,
      earnings: totalRevenue * COMMISSION,
    };
  });

  const totalShopRevenue = appointments.reduce((s, a) => s + (a.services?.price || 0), 0);

  // Per-barber per service breakdown
  const serviceBreakdown = barberNames.flatMap((barber) => {
    const mine = appointments.filter((a) => a.barbers?.name === barber);
    const serviceMap = new Map<string, { count: number; revenue: number }>();
    mine.forEach((a) => {
      const sn = a.services?.name || "Unknown";
      const existing = serviceMap.get(sn) || { count: 0, revenue: 0 };
      serviceMap.set(sn, { count: existing.count + 1, revenue: existing.revenue + (a.services?.price || 0) });
    });
    return Array.from(serviceMap.entries()).map(([service, data]) => ({
      barber,
      service,
      count: data.count,
      revenue: data.revenue,
    }));
  });

  // Bar chart: cuts per day per barber (this week)
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: endOfWeek(now, { weekStartsOn: 1 }) });
  const dailyData = daysOfWeek.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const entry: Record<string, string | number> = { day: format(day, "EEE") };
    barberNames.forEach((name) => {
      entry[name] = appointments.filter(
        (a) => a.appointment_date === dayStr && a.barbers?.name === name
      ).length;
    });
    return entry;
  });

  // Line chart: monthly earnings over last 6 months
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(now, 5 - i);
    const mStr = format(m, "yyyy-MM");
    const label = format(m, "MMM");
    const entry: Record<string, string | number> = { month: label };
    barberNames.forEach((name) => {
      const earnings = appointments
        .filter((a) => a.appointment_date.startsWith(mStr) && a.barbers?.name === name)
        .reduce((s, a) => s + (a.services?.price || 0) * COMMISSION, 0);
      entry[name] = Math.round(earnings);
    });
    return entry;
  });

  const colors = ["#8B1A1A", "#4A7C2F", "#C4A35A"];

  return (
    <div className="space-y-8">
      {/* Notification Settings */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-serif text-lg font-semibold mb-3">Notification Settings</h3>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="font-body text-xs text-muted-foreground mb-1 block">Owner notification email</label>
            <Input
              placeholder="your@gmail.com"
              value={notifEmail}
              onChange={(e) => setNotifEmail(e.target.value)}
              className="bg-background border-border text-foreground font-body"
            />
          </div>
          <Button
            disabled={savingEmail}
            onClick={async () => {
              setSavingEmail(true);
              await (supabase.from("owner_settings" as any) as any).upsert({ key: "notification_email", value: notifEmail.trim() }, { onConflict: "key" });
              setSavingEmail(false);
              toast.success("Saved!");
            }}
            className="bg-accent hover:bg-accent/90 text-background font-body"
          >
            {savingEmail ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Week" value={weekAppts.length} sub="cuts" />
        <StatCard label="This Month" value={monthAppts.length} sub="cuts" />
        <StatCard label="All Time" value={appointments.length} sub="cuts" />
        <StatCard label="Total Revenue" value={`€${totalShopRevenue.toFixed(0)}`} sub="all time" />
      </div>

      {/* Per barber summary */}
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Per Barber</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {perBarber.map((b) => (
            <div key={b.name} className="bg-card border border-border rounded-lg p-4">
              <h4 className="font-serif text-lg font-bold mb-2">{b.name}</h4>
              <div className="grid grid-cols-2 gap-2 font-body text-sm">
                <span className="text-muted-foreground">Week:</span><span className="text-foreground">{b.weekCuts} cuts</span>
                <span className="text-muted-foreground">Month:</span><span className="text-foreground">{b.monthCuts} cuts</span>
                <span className="text-muted-foreground">All time:</span><span className="text-foreground">{b.allTimeCuts} cuts</span>
                <span className="text-muted-foreground">Revenue:</span><span className="text-foreground">€{b.totalRevenue.toFixed(0)}</span>
                <span className="text-muted-foreground">Earnings (50%):</span><span className="text-accent font-medium">€{b.earnings.toFixed(0)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service breakdown */}
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Service Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-4">Barber</th>
                <th className="text-left py-2 pr-4">Service</th>
                <th className="text-right py-2 pr-4">Count</th>
                <th className="text-right py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {serviceBreakdown.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-foreground">{row.barber}</td>
                  <td className="py-2 pr-4 text-foreground">{row.service}</td>
                  <td className="py-2 pr-4 text-right text-foreground">{row.count}</td>
                  <td className="py-2 text-right text-foreground">€{row.revenue.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar chart */}
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Cuts Per Day (This Week)</h3>
        <div className="bg-card border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" stroke="#999" fontSize={12} />
              <YAxis stroke="#999" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#242424", border: "1px solid #333", color: "#F5F5F5" }} />
              <Legend />
              {barberNames.map((name, i) => (
                <Bar key={name} dataKey={name} fill={colors[i % colors.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Line chart */}
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Monthly Earnings (Last 6 Months)</h3>
        <div className="bg-card border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#999" fontSize={12} />
              <YAxis stroke="#999" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#242424", border: "1px solid #333", color: "#F5F5F5" }} />
              <Legend />
              {barberNames.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={colors[i % colors.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub: string }) => (
  <div className="bg-card border border-border rounded-lg p-4 text-center">
    <p className="text-muted-foreground font-body text-xs uppercase tracking-wider">{label}</p>
    <p className="font-serif text-2xl font-bold mt-1">{value}</p>
    <p className="text-muted-foreground font-body text-xs">{sub}</p>
  </div>
);

export default OwnerStatsTab;

```

### `src/components/barber/ScheduleTab.tsx`

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { format, startOfWeek, startOfMonth, isToday, parseISO, isFuture } from "date-fns";
import { Check, X, Clock, Calendar, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notifyWaitingList } from "@/lib/waitingListNotifier";

type Appointment = Tables<"appointments"> & {
  services: { name: string; price: number } | null;
  barbers: { name: string } | null;
};

const ScheduleTab = ({ barberId }: { barberId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, services(name, price), barbers(name)")
      .eq("barber_id", barberId)
      .gte("appointment_date", format(new Date(), "yyyy-MM-dd"))
      .order("appointment_date", { ascending: true })
      .order("time_slot", { ascending: true });

    if (!error && data) setAppointments(data as Appointment[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [barberId]);

  const canCancel = (appt: Appointment): boolean => {
    const now = new Date();
    const [h, m] = appt.time_slot.split(":").map(Number);
    const apptDate = parseISO(appt.appointment_date);
    apptDate.setHours(h, m, 0, 0);
    const diff = apptDate.getTime() - now.getTime();
    return diff >= 2 * 60 * 60 * 1000; // 2 hours
  };

  const updateStatus = async (id: string, status: "completed" | "no-show" | "cancelled", appt?: Appointment) => {
    if (status === "cancelled" && appt && !canCancel(appt)) {
      toast.error("Sorry, this appointment can no longer be cancelled. Please contact us directly.");
      return;
    }

    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success(`Marked as ${status}`);
      fetchAppointments();
      
      // If cancelled, notify waiting list
      if (status === "cancelled" && appt) {
        console.log("[ScheduleTab] Appointment cancelled, notifying waiting list");
        const timeSlot = appt.time_slot.slice(0, 5);
        notifyWaitingList(appt.barber_id, appt.appointment_date, timeSlot, appt.barbers?.name || "");
      }
    }
  };

  const todayAppts = appointments.filter((a) => isToday(parseISO(a.appointment_date)));
  const upcomingAppts = appointments.filter(
    (a) => !isToday(parseISO(a.appointment_date)) && isFuture(parseISO(a.appointment_date))
  );

  if (loading) return <p className="text-muted-foreground font-body p-4">Loading…</p>;

  const AppointmentCard = ({ appt }: { appt: Appointment }) => {
    const cancellable = canCancel(appt);
    return (
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-foreground font-body text-sm font-medium">{appt.time_slot.slice(0, 5)}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-body ${
              appt.status === "booked" ? "bg-accent/20 text-accent" :
              appt.status === "completed" ? "bg-accent text-accent-foreground" :
              "bg-primary/20 text-primary"
            }`}>
              {appt.status}
            </span>
          </div>
          <p className="text-foreground font-body font-medium">{appt.client_name}</p>
          <p className="text-muted-foreground font-body text-sm">
            {appt.services?.name} — €{appt.services?.price?.toFixed(2)}
          </p>
        </div>
        {appt.status === "booked" && (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => updateStatus(appt.id, "completed")}
              className="bg-accent text-accent-foreground hover:bg-accent/80 font-body"
            >
              <Check size={14} className="mr-1" /> Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus(appt.id, "cancelled", appt)}
              className={`font-body ${cancellable
                ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                : "border-border text-muted-foreground/50 cursor-not-allowed"}`}
              title={!cancellable ? "Cannot cancel within 2 hours of appointment" : undefined}
            >
              <Ban size={14} className="mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus(appt.id, "no-show")}
              className="border-border text-foreground hover:bg-muted font-body"
            >
              <X size={14} className="mr-1" /> No-show
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-serif text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-primary" /> Today
        </h3>
        {todayAppts.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm">No appointments today.</p>
        ) : (
          <div className="space-y-3">
            {todayAppts.map((a) => <AppointmentCard key={a.id} appt={a} />)}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-serif text-xl font-semibold mb-4">Upcoming</h3>
        {upcomingAppts.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm">No upcoming appointments.</p>
        ) : (
          <div className="space-y-3">
            {upcomingAppts.map((a) => (
              <div key={a.id}>
                <p className="text-muted-foreground font-body text-xs mb-1">
                  {format(parseISO(a.appointment_date), "EEEE, dd MMM yyyy")}
                </p>
                <AppointmentCard appt={a} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleTab;

```

### `src/components/ui/accordion.tsx`

```tsx
import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };

```

### `src/components/ui/alert-dialog.tsx`

```tsx
import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};

```

### `src/components/ui/alert.tsx`

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };

```

### `src/components/ui/aspect-ratio.tsx`

```tsx
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";

const AspectRatio = AspectRatioPrimitive.Root;

export { AspectRatio };

```

### `src/components/ui/avatar.tsx`

```tsx
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };

```

### `src/components/ui/badge.tsx`

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

```

### `src/components/ui/breadcrumb.tsx`

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode;
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />);
Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<"ol">>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(
        "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
        className,
      )}
      {...props}
    />
  ),
);
BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<"li">>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("inline-flex items-center gap-1.5", className)} {...props} />
  ),
);
BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";

  return <Comp ref={ref} className={cn("transition-colors hover:text-foreground", className)} {...props} />;
});
BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<"span">>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...props}
    />
  ),
);
BreadcrumbPage.displayName = "BreadcrumbPage";

const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<"li">) => (
  <li role="presentation" aria-hidden="true" className={cn("[&>svg]:size-3.5", className)} {...props}>
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
);
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};

```

### `src/components/ui/button.tsx`

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

```

### `src/components/ui/calendar.tsx`

```tsx
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

```

### `src/components/ui/card.tsx`

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

```

### `src/components/ui/carousel.tsx`

```tsx
import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

const Carousel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & CarouselProps>(
  ({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }, ref) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return;
      }

      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev();
    }, [api]);

    const scrollNext = React.useCallback(() => {
      api?.scrollNext();
    }, [api]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (!api || !setApi) {
        return;
      }

      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) {
        return;
      }

      onSelect(api);
      api.on("reInit", onSelect);
      api.on("select", onSelect);

      return () => {
        api?.off("select", onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();

    return (
      <div ref={carouselRef} className="overflow-hidden">
        <div
          ref={ref}
          className={cn("flex", orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col", className)}
          {...props}
        />
      </div>
    );
  },
);
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel();

    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn("min-w-0 shrink-0 grow-0 basis-full", orientation === "horizontal" ? "pl-4" : "pt-4", className)}
        {...props}
      />
    );
  },
);
CarouselItem.displayName = "CarouselItem";

const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "absolute h-8 w-8 rounded-full",
          orientation === "horizontal"
            ? "-left-12 top-1/2 -translate-y-1/2"
            : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        )}
        disabled={!canScrollPrev}
        onClick={scrollPrev}
        {...props}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only">Previous slide</span>
      </Button>
    );
  },
);
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "absolute h-8 w-8 rounded-full",
          orientation === "horizontal"
            ? "-right-12 top-1/2 -translate-y-1/2"
            : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        )}
        disabled={!canScrollNext}
        onClick={scrollNext}
        {...props}
      >
        <ArrowRight className="h-4 w-4" />
        <span className="sr-only">Next slide</span>
      </Button>
    );
  },
);
CarouselNext.displayName = "CarouselNext";

export { type CarouselApi, Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext };

```

### `src/components/ui/chart.tsx`

```tsx
import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([_, config]) => config.theme || config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`,
          )
          .join("\n"),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
      active?: boolean;
      payload?: Array<Record<string, any>>;
      label?: string;
      labelFormatter?: (value: any, payload: Array<Record<string, any>>) => React.ReactNode;
      labelClassName?: string;
      formatter?: (value: any, name: string, item: Record<string, any>, index: number, payload: Record<string, any>) => React.ReactNode;
      color?: string;
      hideLabel?: boolean;
      hideIndicator?: boolean;
      indicator?: "line" | "dot" | "dashed";
      nameKey?: string;
      labelKey?: string;
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey || item.dataKey || item.name || "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label;

      if (labelFormatter) {
        return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>;
      }

      if (!value) {
        return null;
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor = color || item.payload.fill || item.color;

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center",
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn("shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]", {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          })}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center",
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                      </div>
                      {item.value && (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
      payload?: Array<Record<string, any>>;
      verticalAlign?: "top" | "bottom";
      hideIcon?: boolean;
      nameKey?: string;
    }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className)}
    >
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div
            key={item.value}
            className={cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground")}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            {itemConfig?.label}
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegend";

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };

```

### `src/components/ui/checkbox.tsx`

```tsx
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

```

### `src/components/ui/collapsible.tsx`

```tsx
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

```

### `src/components/ui/command.tsx`

```tsx
import * as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps extends DialogProps {}

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />);

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator ref={ref} className={cn("-mx-1 h-px bg-border", className)} {...props} />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};

```

### `src/components/ui/context-menu.tsx`

```tsx
import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuGroup = ContextMenuPrimitive.Group;

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuSub = ContextMenuPrimitive.Sub;

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName;

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold text-foreground", inset && "pl-8", className)}
    {...props}
  />
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};

```

### `src/components/ui/dialog.tsx`

```tsx
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "pointer-events-auto relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

```

### `src/components/ui/drawer.tsx`

```tsx
import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

const Drawer = ({ shouldScaleBackground = true, ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/80", className)} {...props} />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};

```

### `src/components/ui/dropdown-menu.tsx`

```tsx
import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[state=open]:bg-accent focus:bg-accent",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />;
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};

```

### `src/components/ui/form.tsx`

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { Controller, ControllerProps, FieldPath, FieldValues, FormProvider, useFormContext } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId();

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return <Label ref={ref} className={cn(error && "text-destructive", className)} htmlFor={formItemId} {...props} />;
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>(
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

    return (
      <Slot
        ref={ref}
        id={formItemId}
        aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
        aria-invalid={!!error}
        {...props}
      />
    );
  },
);
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField();

    return <p ref={ref} id={formDescriptionId} className={cn("text-sm text-muted-foreground", className)} {...props} />;
  },
);
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error?.message) : children;

    if (!body) {
      return null;
    }

    return (
      <p ref={ref} id={formMessageId} className={cn("text-sm font-medium text-destructive", className)} {...props}>
        {body}
      </p>
    );
  },
);
FormMessage.displayName = "FormMessage";

export { useFormField, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField };

```

### `src/components/ui/hover-card.tsx`

```tsx
import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/utils";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };

```

### `src/components/ui/input-otp.tsx`

```tsx
import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Dot } from "lucide-react";

import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<React.ElementRef<typeof OTPInput>, React.ComponentPropsWithoutRef<typeof OTPInput>>(
  ({ className, containerClassName, ...props }, ref) => (
    <OTPInput
      ref={ref}
      containerClassName={cn("flex items-center gap-2 has-[:disabled]:opacity-50", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  ),
);
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center", className)} {...props} />,
);
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-2 ring-ring ring-offset-background",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink h-4 w-px bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ ...props }, ref) => (
    <div ref={ref} role="separator" {...props}>
      <Dot />
    </div>
  ),
);
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };

```

### `src/components/ui/input.tsx`

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

```

### `src/components/ui/label.tsx`

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };

```

### `src/components/ui/menubar.tsx`

```tsx
import * as React from "react";
import * as MenubarPrimitive from "@radix-ui/react-menubar";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const MenubarMenu = MenubarPrimitive.Menu;

const MenubarGroup = MenubarPrimitive.Group;

const MenubarPortal = MenubarPrimitive.Portal;

const MenubarSub = MenubarPrimitive.Sub;

const MenubarRadioGroup = MenubarPrimitive.RadioGroup;

const Menubar = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn("flex h-10 items-center space-x-1 rounded-md border bg-background p-1", className)}
    {...props}
  />
));
Menubar.displayName = MenubarPrimitive.Root.displayName;

const MenubarTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  />
));
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName;

const MenubarSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </MenubarPrimitive.SubTrigger>
));
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName;

const MenubarSubContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName;

const MenubarContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }, ref) => (
  <MenubarPrimitive.Portal>
    <MenubarPrimitive.Content
      ref={ref}
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </MenubarPrimitive.Portal>
));
MenubarContent.displayName = MenubarPrimitive.Content.displayName;

const MenubarItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
MenubarItem.displayName = MenubarPrimitive.Item.displayName;

const MenubarCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
));
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName;

const MenubarRadioItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
));
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName;

const MenubarLabel = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
));
MenubarLabel.displayName = MenubarPrimitive.Label.displayName;

const MenubarSeparator = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName;

const MenubarShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
};
MenubarShortcut.displayname = "MenubarShortcut";

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
};

```

### `src/components/ui/navigation-menu.tsx`

```tsx
import * as React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
));
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn("group flex flex-1 list-none items-center justify-center space-x-1", className)}
    {...props}
  />
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = NavigationMenuPrimitive.Item;

const navigationMenuTriggerStyle = cva(
  "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
);

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), "group", className)}
    {...props}
  >
    {children}{" "}
    <ChevronDown
      className="relative top-[1px] ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
));
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto",
      className,
    )}
    {...props}
  />
));
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className={cn("absolute left-0 top-full flex justify-center")}>
    <NavigationMenuPrimitive.Viewport
      className={cn(
        "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
        className,
      )}
      ref={ref}
      {...props}
    />
  </div>
));
NavigationMenuViewport.displayName = NavigationMenuPrimitive.Viewport.displayName;

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in",
      className,
    )}
    {...props}
  >
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
  </NavigationMenuPrimitive.Indicator>
));
NavigationMenuIndicator.displayName = NavigationMenuPrimitive.Indicator.displayName;

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
};

```

### `src/components/ui/pagination.tsx`

```tsx
import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonProps, buttonVariants } from "@/components/ui/button";

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />
  ),
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
));
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">;

const PaginationLink = ({ className, isActive, size = "icon", ...props }: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className,
    )}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink aria-label="Go to previous page" size="default" className={cn("gap-1 pl-2.5", className)} {...props}>
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink aria-label="Go to next page" size="default" className={cn("gap-1 pr-2.5", className)} {...props}>
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center", className)} {...props}>
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};

```

### `src/components/ui/popover.tsx`

```tsx
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };

```

### `src/components/ui/progress.tsx`

```tsx
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

```

### `src/components/ui/radio-group.tsx`

```tsx
import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };

```

### `src/components/ui/resizable.tsx`

```tsx
import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };

```

### `src/components/ui/scroll-area.tsx`

```tsx
import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };

```

### `src/components/ui/select.tsx`

```tsx
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};

```

### `src/components/ui/separator.tsx`

```tsx
import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]", className)}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };

```

### `src/components/ui/sheet.tsx`

```tsx
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-secondary hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  ),
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};

```

### `src/components/ui/sidebar.tsx`

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { VariantProps, cva } from "class-variance-authority";
import { PanelLeft } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContext = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(({ defaultOpen = true, open: openProp, onOpenChange: setOpenProp, className, style, children, ...props }, ref) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContext>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn("group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar", className)}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
});
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
  }
>(({ side = "left", variant = "sidebar", collapsible = "offcanvas", className, children, ...props }, ref) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        className={cn("flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground", className)}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      ref={ref}
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        className={cn(
          "relative h-svh w-[--sidebar-width] bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
            : "group-data-[collapsible=icon]:w-[--sidebar-width-icon]",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
            : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow"
        >
          {children}
        </div>
      </div>
    </div>
  );
});
Sidebar.displayName = "Sidebar";

const SidebarTrigger = React.forwardRef<React.ElementRef<typeof Button>, React.ComponentProps<typeof Button>>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();

    return (
      <Button
        ref={ref}
        data-sidebar="trigger"
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", className)}
        onClick={(event) => {
          onClick?.(event);
          toggleSidebar();
        }}
        {...props}
      >
        <PanelLeft />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    );
  },
);
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();

    return (
      <button
        ref={ref}
        data-sidebar="rail"
        aria-label="Toggle Sidebar"
        tabIndex={-1}
        onClick={toggleSidebar}
        title="Toggle Sidebar"
        className={cn(
          "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] group-data-[side=left]:-right-4 group-data-[side=right]:left-0 hover:after:bg-sidebar-border sm:flex",
          "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize",
          "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
          "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
          "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
          "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarRail.displayName = "SidebarRail";

const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<"main">>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex min-h-svh flex-1 flex-col bg-background",
        "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className,
      )}
      {...props}
    />
  );
});
SidebarInset.displayName = "SidebarInset";

const SidebarInput = React.forwardRef<React.ElementRef<typeof Input>, React.ComponentProps<typeof Input>>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        data-sidebar="input"
        className={cn(
          "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarInput.displayName = "SidebarInput";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return <div ref={ref} data-sidebar="header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
});
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return <div ref={ref} data-sidebar="footer" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
});
SidebarFooter.displayName = "SidebarFooter";

const SidebarSeparator = React.forwardRef<React.ElementRef<typeof Separator>, React.ComponentProps<typeof Separator>>(
  ({ className, ...props }, ref) => {
    return (
      <Separator
        ref={ref}
        data-sidebar="separator"
        className={cn("mx-2 w-auto bg-sidebar-border", className)}
        {...props}
      />
    );
  },
);
SidebarSeparator.displayName = "SidebarSeparator";

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
});
SidebarContent.displayName = "SidebarContent";

const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
});
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { asChild?: boolean }>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        data-sidebar="group-label"
        className={cn(
          "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupAction = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button"> & { asChild?: boolean }>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        data-sidebar="group-action"
        className={cn(
          "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          // Increases the hit area of the button on mobile.
          "after:absolute after:-inset-2 after:md:hidden",
          "group-data-[collapsible=icon]:hidden",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarGroupAction.displayName = "SidebarGroupAction";

const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-sidebar="group-content" className={cn("w-full text-sm", className)} {...props} />
  ),
);
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(({ className, ...props }, ref) => (
  <ul ref={ref} data-sidebar="menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
));
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(({ className, ...props }, ref) => (
  <li ref={ref} data-sidebar="menu-item" className={cn("group/menu-item relative", className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(({ asChild = false, isActive = false, variant = "default", size = "default", tooltip, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      ref={ref}
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile} {...tooltip} />
    </Tooltip>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    showOnHover?: boolean;
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform peer-hover/menu-button:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuAction.displayName = "SidebarMenuAction";

const SidebarMenuBadge = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenuBadge.displayName = "SidebarMenuBadge";

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean;
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="h-4 max-w-[--skeleton-width] flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  );
});
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenuSub.displayName = "SidebarMenuSub";

const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(({ ...props }, ref) => (
  <li ref={ref} {...props} />
));
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean;
    size?: "sm" | "md";
    isActive?: boolean;
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};

```

### `src/components/ui/skeleton.tsx`

```tsx
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };

```

### `src/components/ui/slider.tsx`

```tsx
import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

```

### `src/components/ui/sonner.tsx`

```tsx
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };

```

### `src/components/ui/switch.tsx`

```tsx
import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

```

### `src/components/ui/table.tsx`

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };

```

### `src/components/ui/tabs.tsx`

```tsx
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

```

### `src/components/ui/textarea.tsx`

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

```

### `src/components/ui/toast.tsx`

```tsx
import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive: "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors group-[.destructive]:border-muted/40 hover:bg-secondary group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group-[.destructive]:focus:ring-destructive disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 group-[.destructive]:text-red-300 hover:text-foreground group-[.destructive]:hover:text-red-50 focus:opacity-100 focus:outline-none focus:ring-2 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};

```

### `src/components/ui/toaster.tsx`

```tsx
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

```

### `src/components/ui/toggle-group.tsx`

```tsx
import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root ref={ref} className={cn("flex items-center justify-center gap-1", className)} {...props}>
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };

```

### `src/components/ui/toggle.tsx`

```tsx
import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };

```

### `src/components/ui/tooltip.tsx`

```tsx
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

```

### `src/components/ui/use-toast.ts`

```typescript
import { useToast, toast } from "@/hooks/use-toast";

export { useToast, toast };

```

### `src/hooks/use-mobile.tsx`

```tsx
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

```

### `src/hooks/use-toast.ts`

```typescript
import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };

```

### `src/i18n/LanguageContext.tsx`

```tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { translations, LANGUAGES, type LangCode } from "./translations";

const detectBrowserLang = (): LangCode => {
  const browserLang = navigator.language?.split("-")[0]?.toLowerCase() || "en";
  const supported = LANGUAGES.map(l => l.code) as string[];
  return (supported.includes(browserLang) ? browserLang : "en") as LangCode;
};

interface LanguageContextType {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<LangCode>(() => {
    const saved = localStorage.getItem("hof-lang") as LangCode | null;
    if (saved && translations[saved]) return saved;
    return detectBrowserLang();
  });

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    localStorage.setItem("hof-lang", code);
  }, []);

  const t = useCallback(
    (key: string) => translations[lang]?.[key] || translations.en[key] || key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

```

### `src/i18n/translations.ts`

```typescript
export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ga", label: "Gaeilge", flag: "🇮🇪" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export const translations: Record<LangCode, Record<string, string>> = {
  en: {
    // Navbar
    "nav.home": "Home",
    "nav.services": "Services",
    "nav.team": "Team",
    "nav.reviews": "Reviews",
    "nav.contact": "Contact",
    "nav.bookNow": "Book Now",
    // Hero
    "hero.est": "EST. 2025 — Carlow, Ireland",
    "hero.title": "Precision grooming with a cinematic luxury edge.",
    "hero.subtitle": "House of Fades delivers premium cuts, sharp detail, and a high-end barbershop experience designed to feel confident from the first glance.",
    "hero.exploreServices": "Explore Services",
    // Services
    "services.label": "Services",
    "services.title": "Crafted cuts, beard work and refined detail.",
    "services.min": "min",
    // Team
    "team.label": "Team",
    "team.title": "Barbers with presence, precision and personality.",
    "team.bookWith": "Book with",
    // Reviews
    "reviews.label": "Reviews",
    "reviews.title": "Trusted by clients who expect to look sharp.",
    // About
    "about.label": "About",
    "about.title": "A sharper atmosphere, built around confidence and craft.",
    "about.passion": "It's a beautiful thing when a career and a passion come together.",
    "about.fallback": "House has been serving Carlow since 2025.",
    // Hours & Location
    "contact.label": "Contact",
    "contact.title": "Visit the shop and plan your next appointment with ease.",
    "contact.openingHours": "Opening Hours",
    "contact.openToday": "Open today",
    "contact.closedToday": "Closed today",
    "contact.findUs": "Find Us",
    "contact.closed": "Closed",
    // Days
    "day.Monday": "Monday",
    "day.Tuesday": "Tuesday",
    "day.Wednesday": "Wednesday",
    "day.Thursday": "Thursday",
    "day.Friday": "Friday",
    "day.Saturday": "Saturday",
    "day.Sunday": "Sunday",
    // Footer
    "footer.quickLinks": "Quick Links",
    "footer.followUs": "Follow Us",
    "footer.rights": "All rights reserved.",
    // Booking Modal
    "booking.title": "Book Appointment",
    "booking.booked": "Booked!",
    "booking.successMsg": "Your appointment has been booked successfully!",
    "booking.chooseBarber": "Choose your barber",
    "booking.chooseService": "Choose the service",
    "booking.chooseDateTime": "Choose date and time",
    "booking.selectDate": "Select date",
    "booking.yourDetails": "Your details",
    "booking.name": "Name *",
    "booking.phone": "Number",
    "booking.email": "Email *",
    "booking.barber": "Barber:",
    "booking.service": "Service:",
    "booking.date": "Date:",
    "booking.time": "Time:",
    "booking.back": "← Back",
    "booking.continue": "Continue",
    "booking.confirm": "Confirm",
    "booking.confirming": "Booking...",
    "booking.close": "Close",
    "booking.enterName": "Please enter your name",
    "booking.enterEmail": "Please enter your email",
    "booking.errorBooking": "Error booking. Please try again.",
    "booking.at": "at",
  },
  pt: {
    "nav.home": "Início",
    "nav.services": "Serviços",
    "nav.team": "Equipa",
    "nav.reviews": "Avaliações",
    "nav.contact": "Contacto",
    "nav.bookNow": "Agendar",
    "hero.est": "EST. 2025 — Carlow, Irlanda",
    "hero.title": "Cuidado de precisão com um toque de luxo cinematográfico.",
    "hero.subtitle": "House of Fades oferece cortes premium, detalhes afiados e uma experiência de barbearia de alto nível projetada para sentir confiança desde o primeiro olhar.",
    "hero.exploreServices": "Explorar Serviços",
    "services.label": "Serviços",
    "services.title": "Cortes artesanais, trabalho de barba e detalhe refinado.",
    "services.min": "min",
    "team.label": "Equipa",
    "team.title": "Barbeiros com presença, precisão e personalidade.",
    "team.bookWith": "Agendar com",
    "reviews.label": "Avaliações",
    "reviews.title": "Confiado por clientes que esperam estar impecáveis.",
    "about.label": "Sobre",
    "about.title": "Uma atmosfera mais afiada, construída em torno de confiança e ofício.",
    "about.passion": "É uma coisa bonita quando uma carreira e uma paixão se juntam.",
    "about.fallback": "House serve Carlow desde 2025.",
    "contact.label": "Contacto",
    "contact.title": "Visite a loja e planeie a sua próxima marcação com facilidade.",
    "contact.openingHours": "Horário de Funcionamento",
    "contact.openToday": "Aberto hoje",
    "contact.closedToday": "Fechado hoje",
    "contact.findUs": "Encontre-nos",
    "contact.closed": "Fechado",
    "day.Monday": "Segunda",
    "day.Tuesday": "Terça",
    "day.Wednesday": "Quarta",
    "day.Thursday": "Quinta",
    "day.Friday": "Sexta",
    "day.Saturday": "Sábado",
    "day.Sunday": "Domingo",
    "footer.quickLinks": "Links Rápidos",
    "footer.followUs": "Siga-nos",
    "footer.rights": "Todos os direitos reservados.",
    "booking.title": "Agendar Horário",
    "booking.booked": "Agendado!",
    "booking.successMsg": "Seu horário foi agendado com sucesso!",
    "booking.chooseBarber": "Escolha seu barbeiro",
    "booking.chooseService": "Escolha o serviço",
    "booking.chooseDateTime": "Escolha data e horário",
    "booking.selectDate": "Selecionar data",
    "booking.yourDetails": "Seus dados",
    "booking.name": "Nome *",
    "booking.phone": "Número",
    "booking.email": "Email *",
    "booking.barber": "Barbeiro:",
    "booking.service": "Serviço:",
    "booking.date": "Data:",
    "booking.time": "Horário:",
    "booking.back": "← Voltar",
    "booking.continue": "Continuar",
    "booking.confirm": "Confirmar",
    "booking.confirming": "Agendando...",
    "booking.close": "Fechar",
    "booking.enterName": "Insira seu nome",
    "booking.enterEmail": "Insira seu email",
    "booking.errorBooking": "Erro ao agendar. Tente novamente.",
    "booking.at": "às",
  },
  es: {
    "nav.home": "Inicio",
    "nav.services": "Servicios",
    "nav.team": "Equipo",
    "nav.reviews": "Reseñas",
    "nav.contact": "Contacto",
    "nav.bookNow": "Reservar",
    "hero.est": "EST. 2025 — Carlow, Irlanda",
    "hero.title": "Cuidado de precisión con un toque de lujo cinematográfico.",
    "hero.subtitle": "House of Fades ofrece cortes premium, detalles afilados y una experiencia de barbería de alto nivel diseñada para sentir confianza desde la primera mirada.",
    "hero.exploreServices": "Explorar Servicios",
    "services.label": "Servicios",
    "services.title": "Cortes artesanales, trabajo de barba y detalle refinado.",
    "services.min": "min",
    "team.label": "Equipo",
    "team.title": "Barberos con presencia, precisión y personalidad.",
    "team.bookWith": "Reservar con",
    "reviews.label": "Reseñas",
    "reviews.title": "Confiado por clientes que esperan lucir impecables.",
    "about.label": "Acerca de",
    "about.title": "Una atmósfera más afilada, construida alrededor de confianza y oficio.",
    "about.passion": "Es algo hermoso cuando una carrera y una pasión se unen.",
    "about.fallback": "House sirve a Carlow desde 2025.",
    "contact.label": "Contacto",
    "contact.title": "Visita la tienda y planifica tu próxima cita con facilidad.",
    "contact.openingHours": "Horario de Apertura",
    "contact.openToday": "Abierto hoy",
    "contact.closedToday": "Cerrado hoy",
    "contact.findUs": "Encuéntranos",
    "contact.closed": "Cerrado",
    "day.Monday": "Lunes",
    "day.Tuesday": "Martes",
    "day.Wednesday": "Miércoles",
    "day.Thursday": "Jueves",
    "day.Friday": "Viernes",
    "day.Saturday": "Sábado",
    "day.Sunday": "Domingo",
    "footer.quickLinks": "Enlaces Rápidos",
    "footer.followUs": "Síguenos",
    "footer.rights": "Todos los derechos reservados.",
    "booking.title": "Reservar Cita",
    "booking.booked": "¡Reservado!",
    "booking.successMsg": "¡Tu cita ha sido reservada con éxito!",
    "booking.chooseBarber": "Elige tu barbero",
    "booking.chooseService": "Elige el servicio",
    "booking.chooseDateTime": "Elige fecha y hora",
    "booking.selectDate": "Seleccionar fecha",
    "booking.yourDetails": "Tus datos",
    "booking.name": "Nombre *",
    "booking.phone": "Número",
    "booking.email": "Email *",
    "booking.barber": "Barbero:",
    "booking.service": "Servicio:",
    "booking.date": "Fecha:",
    "booking.time": "Hora:",
    "booking.back": "← Volver",
    "booking.continue": "Continuar",
    "booking.confirm": "Confirmar",
    "booking.confirming": "Reservando...",
    "booking.close": "Cerrar",
    "booking.enterName": "Introduce tu nombre",
    "booking.enterEmail": "Introduce tu email",
    "booking.errorBooking": "Error al reservar. Inténtalo de nuevo.",
    "booking.at": "a las",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.services": "Services",
    "nav.team": "Équipe",
    "nav.reviews": "Avis",
    "nav.contact": "Contact",
    "nav.bookNow": "Réserver",
    "hero.est": "EST. 2025 — Carlow, Irlande",
    "hero.title": "Un soin de précision avec une touche de luxe cinématographique.",
    "hero.subtitle": "House of Fades propose des coupes premium, des détails soignés et une expérience de barbier haut de gamme conçue pour inspirer confiance dès le premier regard.",
    "hero.exploreServices": "Explorer les Services",
    "services.label": "Services",
    "services.title": "Coupes artisanales, travail de barbe et détails raffinés.",
    "services.min": "min",
    "team.label": "Équipe",
    "team.title": "Des barbiers avec présence, précision et personnalité.",
    "team.bookWith": "Réserver avec",
    "reviews.label": "Avis",
    "reviews.title": "Approuvé par des clients qui veulent être impeccables.",
    "about.label": "À propos",
    "about.title": "Une atmosphère plus affûtée, construite autour de la confiance et du savoir-faire.",
    "about.passion": "C'est une belle chose quand une carrière et une passion se rejoignent.",
    "about.fallback": "House sert Carlow depuis 2025.",
    "contact.label": "Contact",
    "contact.title": "Visitez le salon et planifiez votre prochain rendez-vous facilement.",
    "contact.openingHours": "Heures d'Ouverture",
    "contact.openToday": "Ouvert aujourd'hui",
    "contact.closedToday": "Fermé aujourd'hui",
    "contact.findUs": "Nous Trouver",
    "contact.closed": "Fermé",
    "day.Monday": "Lundi",
    "day.Tuesday": "Mardi",
    "day.Wednesday": "Mercredi",
    "day.Thursday": "Jeudi",
    "day.Friday": "Vendredi",
    "day.Saturday": "Samedi",
    "day.Sunday": "Dimanche",
    "footer.quickLinks": "Liens Rapides",
    "footer.followUs": "Suivez-nous",
    "footer.rights": "Tous droits réservés.",
    "booking.title": "Prendre Rendez-vous",
    "booking.booked": "Réservé !",
    "booking.successMsg": "Votre rendez-vous a été réservé avec succès !",
    "booking.chooseBarber": "Choisissez votre barbier",
    "booking.chooseService": "Choisissez le service",
    "booking.chooseDateTime": "Choisissez la date et l'heure",
    "booking.selectDate": "Sélectionner une date",
    "booking.yourDetails": "Vos informations",
    "booking.name": "Nom *",
    "booking.phone": "Numéro",
    "booking.email": "Email *",
    "booking.barber": "Barbier :",
    "booking.service": "Service :",
    "booking.date": "Date :",
    "booking.time": "Heure :",
    "booking.back": "← Retour",
    "booking.continue": "Continuer",
    "booking.confirm": "Confirmer",
    "booking.confirming": "Réservation...",
    "booking.close": "Fermer",
    "booking.enterName": "Entrez votre nom",
    "booking.enterEmail": "Entrez votre email",
    "booking.errorBooking": "Erreur de réservation. Réessayez.",
    "booking.at": "à",
  },
  it: {
    "nav.home": "Home",
    "nav.services": "Servizi",
    "nav.team": "Team",
    "nav.reviews": "Recensioni",
    "nav.contact": "Contatto",
    "nav.bookNow": "Prenota",
    "hero.est": "EST. 2025 — Carlow, Irlanda",
    "hero.title": "Cura di precisione con un tocco di lusso cinematografico.",
    "hero.subtitle": "House of Fades offre tagli premium, dettagli affilati e un'esperienza di barbiere di alto livello progettata per sentirsi sicuri dal primo sguardo.",
    "hero.exploreServices": "Esplora Servizi",
    "services.label": "Servizi",
    "services.title": "Tagli artigianali, lavoro di barba e dettagli raffinati.",
    "services.min": "min",
    "team.label": "Team",
    "team.title": "Barbieri con presenza, precisione e personalità.",
    "team.bookWith": "Prenota con",
    "reviews.label": "Recensioni",
    "reviews.title": "Fidato da clienti che si aspettano di essere impeccabili.",
    "about.label": "Chi Siamo",
    "about.title": "Un'atmosfera più affilata, costruita attorno a fiducia e maestria.",
    "about.passion": "È una cosa bellissima quando una carriera e una passione si incontrano.",
    "about.fallback": "House serve Carlow dal 2025.",
    "contact.label": "Contatto",
    "contact.title": "Visita il negozio e pianifica il tuo prossimo appuntamento con facilità.",
    "contact.openingHours": "Orari di Apertura",
    "contact.openToday": "Aperto oggi",
    "contact.closedToday": "Chiuso oggi",
    "contact.findUs": "Trovaci",
    "contact.closed": "Chiuso",
    "day.Monday": "Lunedì",
    "day.Tuesday": "Martedì",
    "day.Wednesday": "Mercoledì",
    "day.Thursday": "Giovedì",
    "day.Friday": "Venerdì",
    "day.Saturday": "Sabato",
    "day.Sunday": "Domenica",
    "footer.quickLinks": "Link Rapidi",
    "footer.followUs": "Seguici",
    "footer.rights": "Tutti i diritti riservati.",
    "booking.title": "Prenota Appuntamento",
    "booking.booked": "Prenotato!",
    "booking.successMsg": "Il tuo appuntamento è stato prenotato con successo!",
    "booking.chooseBarber": "Scegli il tuo barbiere",
    "booking.chooseService": "Scegli il servizio",
    "booking.chooseDateTime": "Scegli data e ora",
    "booking.selectDate": "Seleziona data",
    "booking.yourDetails": "I tuoi dati",
    "booking.name": "Nome *",
    "booking.phone": "Numero",
    "booking.email": "Email *",
    "booking.barber": "Barbiere:",
    "booking.service": "Servizio:",
    "booking.date": "Data:",
    "booking.time": "Ora:",
    "booking.back": "← Indietro",
    "booking.continue": "Continua",
    "booking.confirm": "Conferma",
    "booking.confirming": "Prenotazione...",
    "booking.close": "Chiudi",
    "booking.enterName": "Inserisci il tuo nome",
    "booking.enterEmail": "Inserisci la tua email",
    "booking.errorBooking": "Errore nella prenotazione. Riprova.",
    "booking.at": "alle",
  },
  de: {
    "nav.home": "Startseite",
    "nav.services": "Dienste",
    "nav.team": "Team",
    "nav.reviews": "Bewertungen",
    "nav.contact": "Kontakt",
    "nav.bookNow": "Buchen",
    "hero.est": "EST. 2025 — Carlow, Irland",
    "hero.title": "Präzisionspflege mit einem Hauch von filmischem Luxus.",
    "hero.subtitle": "House of Fades bietet Premium-Schnitte, scharfe Details und ein erstklassiges Barbershop-Erlebnis, das vom ersten Blick an Selbstvertrauen verleiht.",
    "hero.exploreServices": "Dienste Entdecken",
    "services.label": "Dienste",
    "services.title": "Handwerkliche Schnitte, Bartarbeit und verfeinerte Details.",
    "services.min": "Min",
    "team.label": "Team",
    "team.title": "Barbiere mit Präsenz, Präzision und Persönlichkeit.",
    "team.bookWith": "Buchen bei",
    "reviews.label": "Bewertungen",
    "reviews.title": "Vertraut von Kunden, die scharf aussehen wollen.",
    "about.label": "Über Uns",
    "about.title": "Eine schärfere Atmosphäre, gebaut auf Vertrauen und Handwerk.",
    "about.passion": "Es ist etwas Schönes, wenn Karriere und Leidenschaft zusammenkommen.",
    "about.fallback": "House bedient Carlow seit 2025.",
    "contact.label": "Kontakt",
    "contact.title": "Besuchen Sie den Shop und planen Sie Ihren nächsten Termin mit Leichtigkeit.",
    "contact.openingHours": "Öffnungszeiten",
    "contact.openToday": "Heute geöffnet",
    "contact.closedToday": "Heute geschlossen",
    "contact.findUs": "Finden Sie Uns",
    "contact.closed": "Geschlossen",
    "day.Monday": "Montag",
    "day.Tuesday": "Dienstag",
    "day.Wednesday": "Mittwoch",
    "day.Thursday": "Donnerstag",
    "day.Friday": "Freitag",
    "day.Saturday": "Samstag",
    "day.Sunday": "Sonntag",
    "footer.quickLinks": "Schnelllinks",
    "footer.followUs": "Folgen Sie Uns",
    "footer.rights": "Alle Rechte vorbehalten.",
    "booking.title": "Termin Buchen",
    "booking.booked": "Gebucht!",
    "booking.successMsg": "Ihr Termin wurde erfolgreich gebucht!",
    "booking.chooseBarber": "Wählen Sie Ihren Barbier",
    "booking.chooseService": "Wählen Sie den Service",
    "booking.chooseDateTime": "Wählen Sie Datum und Uhrzeit",
    "booking.selectDate": "Datum wählen",
    "booking.yourDetails": "Ihre Daten",
    "booking.name": "Name *",
    "booking.phone": "Nummer",
    "booking.email": "Email *",
    "booking.barber": "Barbier:",
    "booking.service": "Service:",
    "booking.date": "Datum:",
    "booking.time": "Uhrzeit:",
    "booking.back": "← Zurück",
    "booking.continue": "Weiter",
    "booking.confirm": "Bestätigen",
    "booking.confirming": "Buchung...",
    "booking.close": "Schließen",
    "booking.enterName": "Geben Sie Ihren Namen ein",
    "booking.enterEmail": "Geben Sie Ihre Email ein",
    "booking.errorBooking": "Fehler beim Buchen. Versuchen Sie es erneut.",
    "booking.at": "um",
  },
  ga: {
    "nav.home": "Baile",
    "nav.services": "Seirbhísí",
    "nav.team": "Foireann",
    "nav.reviews": "Léirmheasanna",
    "nav.contact": "Teagmháil",
    "nav.bookNow": "Cuir in Áirithe",
    "hero.est": "BUNA. 2025 — Ceatharlach, Éire",
    "hero.title": "Grúmáil bheacht le ciumhais saibhris scannánaíochta.",
    "hero.subtitle": "Cuireann House of Fades gearrthacha préimhe, sonraí géara, agus eispéireas bearbóireachta ardchaighdeáin ar fáil atá deartha chun muinín a thabhairt ón gcéad amharc.",
    "hero.exploreServices": "Féach ar Sheirbhísí",
    "services.label": "Seirbhísí",
    "services.title": "Gearrthacha ceardaithe, obair féasóige agus mionsonraí fíneáilte.",
    "services.min": "nóim",
    "team.label": "Foireann",
    "team.title": "Bearbóirí le láithreacht, beachtas agus pearsantacht.",
    "team.bookWith": "Cuir in áirithe le",
    "reviews.label": "Léirmheasanna",
    "reviews.title": "Muinín ag cliaint a bhfuil súil acu bheith go snasta.",
    "about.label": "Fúinn",
    "about.title": "Atmaisféar níos géire, tógtha timpeall ar mhuinín agus ceardaíocht.",
    "about.passion": "Is rud álainn é nuair a thagann gairm agus paisean le chéile.",
    "about.fallback": "Tá House ag freastal ar Cheatharlach ó 2025.",
    "contact.label": "Teagmháil",
    "contact.title": "Tabhair cuairt ar an siopa agus pleanáil do chéad choinne eile go héasca.",
    "contact.openingHours": "Uaireanta Oscailte",
    "contact.openToday": "Oscailte inniu",
    "contact.closedToday": "Dúnta inniu",
    "contact.findUs": "Aimsigh Muid",
    "contact.closed": "Dúnta",
    "day.Monday": "Luan",
    "day.Tuesday": "Máirt",
    "day.Wednesday": "Céadaoin",
    "day.Thursday": "Déardaoin",
    "day.Friday": "Aoine",
    "day.Saturday": "Satharn",
    "day.Sunday": "Domhnach",
    "footer.quickLinks": "Naisc Thapa",
    "footer.followUs": "Lean Muid",
    "footer.rights": "Gach ceart ar cosaint.",
    "booking.title": "Cuir Coinne in Áirithe",
    "booking.booked": "Curtha in Áirithe!",
    "booking.successMsg": "Cuireadh do choinne in áirithe go rathúil!",
    "booking.chooseBarber": "Roghnaigh do bhearbóir",
    "booking.chooseService": "Roghnaigh an tseirbhís",
    "booking.chooseDateTime": "Roghnaigh dáta agus am",
    "booking.selectDate": "Roghnaigh dáta",
    "booking.yourDetails": "Do shonraí",
    "booking.name": "Ainm *",
    "booking.phone": "Uimhir",
    "booking.email": "Ríomhphost *",
    "booking.barber": "Bearbóir:",
    "booking.service": "Seirbhís:",
    "booking.date": "Dáta:",
    "booking.time": "Am:",
    "booking.back": "← Ar ais",
    "booking.continue": "Lean ar aghaidh",
    "booking.confirm": "Deimhnigh",
    "booking.confirming": "Ag cur in áirithe...",
    "booking.close": "Dún",
    "booking.enterName": "Cuir d'ainm isteach",
    "booking.enterEmail": "Cuir do ríomhphost isteach",
    "booking.errorBooking": "Earráid ag cur in áirithe. Bain triail eile as.",
    "booking.at": "ag",
  },
};

```

### `src/index.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');

@media screen and (-webkit-min-device-pixel-ratio: 0) {
  select,
  textarea,
  input {
    font-size: 16px !important;
  }
}

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 4%;
    --foreground: 0 0% 94%;

    --card: 0 0% 7%;
    --card-foreground: 0 0% 94%;

    --popover: 0 0% 7%;
    --popover-foreground: 0 0% 94%;

    --primary: 0 68% 33%;
    --primary-foreground: 0 0% 100%;

    --secondary: 0 0% 5%;
    --secondary-foreground: 0 0% 94%;

    --muted: 0 0% 15%;
    --muted-foreground: 0 0% 60%;

    --accent: 43 74% 52%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 100%;

    --border: 43 52% 54% / 0.15;
    --input: 0 0% 15%;
    --ring: 43 52% 54%;

    --radius: 0.5rem;

    --gold: 43 74% 52%;
    --gold-glow: 0 0 20px hsla(43, 52%, 54%, 0.4);

    --sidebar-background: 0 0% 5%;
    --sidebar-foreground: 0 0% 94%;
    --sidebar-primary: 0 68% 33%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 0 0% 10%;
    --sidebar-accent-foreground: 0 0% 94%;
    --sidebar-border: 43 52% 54% / 0.15;
    --sidebar-ring: 43 52% 54%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Playfair Display', serif;
    color: hsl(0, 0%, 100%);
    letter-spacing: -0.02em;
  }
}

@layer utilities {
  .font-serif-display {
    font-family: 'Playfair Display', serif;
  }

  .font-body {
    font-family: 'Inter', sans-serif;
  }

  .gold-title-gradient {
    background: linear-gradient(135deg, #d4af37, #fff, #d4af37);
    background-size: 200% 200%;
    animation: shimmer 3s ease-in-out infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .gold-shimmer {
    background: linear-gradient(135deg, hsl(43, 52%, 54%), hsl(43, 60%, 65%), hsl(43, 52%, 54%));
    background-size: 200% 200%;
    animation: shimmer 3s ease-in-out infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .gold-border-glow {
    border: 1px solid hsla(43, 52%, 54%, 0.3);
    box-shadow: 0 0 15px hsla(43, 52%, 54%, 0.08), inset 0 0 15px hsla(43, 52%, 54%, 0.03);
  }

  .glass-card {
    background: hsla(0, 0%, 7%, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn-gold-outline {
    border: 2px solid hsl(43, 52%, 54%);
    border-radius: 2px;
    color: hsl(43, 52%, 54%);
    background: transparent;
    position: relative;
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease, color 0.3s ease;
    z-index: 0;
  }
  .btn-gold-outline::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, hsla(43, 52%, 54%, 0.15), hsla(43, 60%, 65%, 0.25), hsla(43, 52%, 54%, 0.15), transparent);
    transition: left 0.5s ease;
    z-index: -1;
  }
  .btn-gold-outline:hover::before {
    left: 100%;
  }
  .btn-gold-outline:hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px hsla(43, 52%, 54%, 0.3), 0 0 40px hsla(43, 52%, 54%, 0.1);
  }

  .btn-primary-glow {
    background: hsl(0, 68%, 33%);
    border: 2px solid hsl(43, 52%, 54%);
    border-radius: 2px;
    position: relative;
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
    z-index: 0;
  }
  .btn-primary-glow::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, hsla(43, 52%, 54%, 0.2), hsla(43, 60%, 65%, 0.35), hsla(43, 52%, 54%, 0.2), transparent);
    transition: left 0.5s ease;
    z-index: -1;
  }
  .btn-primary-glow:hover::before {
    left: 100%;
  }
  .btn-primary-glow:hover {
    background: hsl(0, 68%, 38%);
    transform: scale(1.05);
    box-shadow: 0 0 25px hsla(43, 52%, 54%, 0.35), 0 0 50px hsla(0, 68%, 33%, 0.2);
  }

  .btn-book-pulse {
    animation: book-pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes book-pulse-ring {
    0%, 100% {
      box-shadow: 0 0 0 0 hsla(43, 52%, 54%, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px hsla(43, 52%, 54%, 0);
    }
  }

  .section-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, hsl(43, 52%, 54%), transparent);
    opacity: 0.3;
  }

  @keyframes shimmer {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeUpForm {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes borderRun {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }


  @keyframes shimmerGold {
    0% { background-position: -300% center; }
    100% { background-position: 300% center; }
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 15px hsla(0, 68%, 33%, 0.3); }
    50% { box-shadow: 0 0 30px hsla(0, 68%, 33%, 0.6), 0 0 10px hsla(43, 52%, 54%, 0.15); }
  }

  @keyframes float-up {
    0% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-100vh); opacity: 0; }
  }
  @keyframes scissors-3d {
    0% { transform: rotateY(0deg) rotateX(0deg); }
    25% { transform: rotateY(90deg) rotateX(10deg); }
    50% { transform: rotateY(180deg) rotateX(0deg); }
    75% { transform: rotateY(270deg) rotateX(-10deg); }
    100% { transform: rotateY(360deg) rotateX(0deg); }
  }

  .scissors-3d-rotate {
    animation: scissors-3d 20s linear infinite;
    transform-style: preserve-3d;
  }
  .card-shimmer-border {
    position: relative;
    overflow: hidden;
  }
  .card-shimmer-border::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 1px solid transparent;
    background: linear-gradient(90deg, transparent, hsla(43, 52%, 54%, 0.5), transparent) border-box;
    -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 0.3s ease;
    animation: border-sweep 2s linear infinite paused;
    background-size: 200% 100%;
  }
  .card-shimmer-border:hover::after {
    opacity: 1;
    animation-play-state: running;
  }

  @keyframes border-sweep {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes prefPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220, 50, 50, 0); border-color: rgba(220, 50, 50, 0.5); }
    50% { box-shadow: 0 0 0 4px rgba(220, 50, 50, 0.15); border-color: rgba(220, 50, 50, 0.9); }
  }
  @keyframes prefShake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }

  .grain-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    pointer-events: none;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 256px 256px;
  }
}

*, *::before, *::after {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  touch-action: manipulation;
}

input,
input[type="text"],
input[type="email"],
input[type="password"],
input[type="tel"],
input[type="number"],
select,
textarea,
button {
  font-size: 16px !important;
  -webkit-text-size-adjust: 100% !important;
}

html {
  scroll-behavior: smooth;
}

#lovable-badge {
  display: none !important;
}

@keyframes authFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes authBorderRun { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes authShimmer { 0% { background-position: -300% center; } 100% { background-position: 300% center; } }

.auth-border-box {
  padding: 1.5px;
  border-radius: 12px;
  background: rgba(255,255,255,0.07);
  transition: all 0.3s;
}
.auth-border-box:focus-within {
  background: linear-gradient(90deg, #A07830, #C9A84C, #f5e49c, #C9A84C, #A07830);
  background-size: 200% auto;
  animation: authBorderRun 1.8s linear infinite;
}

.auth-modal-content > button[class*="absolute"] {
  color: rgba(255,255,255,0.3);
}

[data-radix-dialog-content] {
  width: min(95vw, 448px) !important;
  max-height: 85dvh !important;
  overflow-y: auto !important;
  margin: 0 !important;
  transform: none !important;
  -webkit-transform: none !important;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

[data-radix-dialog-overlay] {
  position: fixed !important;
  inset: 0 !important;
}

```

### `src/lib/calendarDownload.ts`

```typescript
export function downloadICS(date: string, time: string, barberName: string, serviceName: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  const pad = (n: number) => String(n).padStart(2, '0');

  const dtStart = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
  const endHour = minute + 30 >= 60 ? hour + 1 : hour;
  const endMinute = (minute + 30) % 60;
  const dtEnd = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(endMinute)}00`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//House of Fades//Booking//EN',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `DTSTAMP:${dtStamp}`,
    `SUMMARY:${serviceName} - House of Fades`,
    `DESCRIPTION:Appointment with ${barberName}`,
    'LOCATION:House of Fades, Carlow, Ireland',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'house-of-fades-appointment.ics');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

```

### `src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### `src/lib/waitingListNotifier.ts`

```typescript
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
    console.log("[WaitingListNotifier] Sending EmailJS notification to:", waiter.client_email);
    try {
      const emailResult = await emailjs.send(
        "service_y59db7l",
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

```

### `src/main.tsx`

```tsx
import './styles/no-zoom.css';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

```

### `src/pages/AcceptBooking.tsx`

```tsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";

let emailjsInited = false;

const AcceptBooking = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const process = async () => {
      const date = params.get("date");
      const time = params.get("time");
      const barberId = params.get("barber");
      const name = params.get("name");
      const email = params.get("email");
      const phone = params.get("phone");
      const waitingId = params.get("waitingId");

      if (!date || !time || !barberId || !name || !waitingId) {
        setErrorMsg("Invalid link.");
        setStatus("error");
        return;
      }

      // Check if waiting list entry is still valid
      const { data: entry } = await supabase
        .from("waiting_list")
        .select("*")
        .eq("id", waitingId)
        .single();

      if (!entry || entry.status === "cancelled" || entry.status === "declined" || entry.status === "accepted") {
        setErrorMsg("This link has expired or already been used.");
        setStatus("error");
        return;
      }

      // Check if slot is still available
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("barber_id", barberId)
        .eq("appointment_date", date)
        .eq("time_slot", time)
        .in("status", ["booked", "confirmed"]);

      if (existing && existing.length > 0) {
        setErrorMsg("Sorry! This slot was just filled by someone else. We'll notify you when another slot opens up! 🙏");
        setStatus("error");
        return;
      }

      // Get a service_id
      let serviceId = barberId; // fallback
      const { data: services } = await supabase.from("services").select("id").limit(1);
      if (services && services.length > 0) {
        serviceId = services[0].id;
      }

      // Book the appointment
      const { error: bookError } = await supabase.from("appointments").insert({
        barber_id: barberId,
        service_id: serviceId,
        appointment_date: date,
        time_slot: time,
        client_name: name,
        client_email: email || null,
        client_phone: phone || null,
      });

      if (bookError) {
        console.error("Booking error:", bookError);
        setErrorMsg("Error booking appointment. Please try again.");
        setStatus("error");
        return;
      }

      // Update this waiting list entry to accepted
      await supabase.from("waiting_list").update({ status: "accepted" }).eq("id", waitingId);

      // Cancel all other waiting list entries for this slot
      await supabase.from("waiting_list")
        .update({ status: "cancelled" })
        .eq("barber_id", barberId)
        .eq("appointment_date", date)
        .eq("time_slot", entry.time_slot)
        .neq("id", waitingId)
        .in("status", ["pending", "notified"]);

      // Send confirmation email
      if (email) {
        try {
          if (!emailjsInited) {
            emailjs.init("TBNWeHLfrq6OuvZhQ");
            emailjsInited = true;
          }
          await emailjs.send("service_y59db7l", "template_7i3p8r9", {
            to_name: name,
            to_email: email,
            date: date,
            time: time,
            service: "Appointment",
            barber: "House of Fades",
            price: "",
          });
          console.log("Confirmation email sent");
        } catch (err) {
          console.error("EmailJS confirmation error:", err);
        }
      }

      // Send confirmation SMS
      if (phone) {
        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              action: "confirmation",
              phone: phone,
              clientName: name,
              barberName: "House of Fades",
              serviceName: "Appointment",
              date: date,
              time: time,
            },
          });
          console.log("Confirmation SMS sent");
        } catch (err) {
          console.error("SMS confirmation error:", err);
        }
      }

      setStatus("success");
      setTimeout(() => navigate("/"), 3000);
    };

    process();
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-accent animate-spin" />
            <p className="text-foreground font-body text-lg">Processing your booking...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">Your appointment has been booked!</h1>
            <p className="text-muted-foreground font-body">See you soon 🎉</p>
            <p className="text-muted-foreground font-body text-sm">Redirecting in 3 seconds...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="font-serif text-2xl text-foreground">Oops!</h1>
            <p className="text-muted-foreground font-body">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptBooking;

```

### `src/pages/AdminPortal.tsx`

```tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Layout, Users } from "lucide-react";
import AdminLogin from "@/components/admin/AdminLogin";
import EditClientViewTab from "@/components/admin/EditClientViewTab";
import EditBarberViewTab from "@/components/admin/EditBarberViewTab";

const AdminPortal = () => {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setIsAdmin(false); setLoading(false); return; }
    const checkAdmin = async () => {
      const { data } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setIsAdmin(!!data);
      setLoading(false);
    };
    checkAdmin();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading…</p>
      </div>
    );
  }

  if (!session) return <AdminLogin />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="font-serif text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground font-body mb-4">You don't have admin privileges.</p>
          <Button onClick={handleLogout} variant="outline" className="border-border text-foreground">Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-secondary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <span className="font-serif text-lg text-primary-foreground">House</span>
            <span className="text-muted-foreground font-body text-sm ml-3">Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut size={16} className="mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="client-view">
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="client-view" className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Layout size={16} className="mr-1.5" /> Edit Client View
            </TabsTrigger>
            <TabsTrigger value="barber-view" className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users size={16} className="mr-1.5" /> Edit Barber View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client-view">
            <EditClientViewTab />
          </TabsContent>
          <TabsContent value="barber-view">
            <EditBarberViewTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPortal;

```

### `src/pages/BarberPortal.tsx`

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, CalendarDays } from "lucide-react";
import OwnerStatsTab from "@/components/barber/OwnerStatsTab";
import EmployeeStatsTab from "@/components/barber/EmployeeStatsTab";
import ScheduleTab from "@/components/barber/ScheduleTab";
import BarberLogin from "@/components/barber/BarberLogin";

type Barber = Tables<"barbers">;

const BarberPortal = () => {
  const [session, setSession] = useState<any>(null);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setBarber(null);
      setLoading(false);
      return;
    }

    const fetchBarber = async () => {
      const { data } = await supabase
        .from("barbers")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setBarber(data);
      setLoading(false);
    };
    fetchBarber();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setBarber(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading…</p>
      </div>
    );
  }

  if (!session) return <BarberLogin />;

  if (!barber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="font-serif text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground font-body mb-4">
            Your account is not linked to a barber profile.
          </p>
          <Button onClick={handleLogout} variant="outline" className="border-border text-foreground">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = barber.role === "owner";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-secondary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <span className="font-serif text-lg text-primary-foreground">House</span>
            <span className="text-muted-foreground font-body text-sm ml-3">
              {barber.name} • {isOwner ? "Owner" : "Barber"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut size={16} className="mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="stats">
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="stats" className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 size={16} className="mr-1.5" />
              {isOwner ? "Shop Stats" : "My Stats"}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="font-body data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CalendarDays size={16} className="mr-1.5" />
              My Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
            {isOwner ? <OwnerStatsTab /> : <EmployeeStatsTab barberId={barber.id} />}
          </TabsContent>
          <TabsContent value="schedule">
            <ScheduleTab barberId={barber.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BarberPortal;

```

### `src/pages/DeclineBooking.tsx`

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const DeclineBooking = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ask" | "removed" | "kept">("loading");
  const waitingId = params.get("waitingId");

  useEffect(() => {
    if (!waitingId) {
      setStatus("removed");
      return;
    }
    // Just show the question
    setStatus("ask");
  }, [waitingId]);

  const handleRemove = async () => {
    setStatus("loading");
    await supabase.from("waiting_list").update({ status: "declined" }).eq("id", waitingId!);
    setStatus("removed");
  };

  const handleKeep = () => {
    setStatus("kept");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <Loader2 className="w-16 h-16 mx-auto text-accent animate-spin" />
        )}

        {status === "ask" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-3xl">🤔</span>
            </div>
            <h1 className="font-serif text-2xl text-foreground">Do you want to leave the waiting list?</h1>
            <div className="flex gap-4 justify-center pt-4">
              <Button
                onClick={handleRemove}
                variant="destructive"
                className="font-body px-6 py-3"
              >
                Yes, remove me
              </Button>
              <Button
                onClick={handleKeep}
                className="bg-accent hover:bg-accent/90 text-background font-body px-6 py-3"
              >
                No, keep me in
              </Button>
            </div>
          </>
        )}

        {status === "removed" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">Done!</h1>
            <p className="text-muted-foreground font-body">You have been removed from the waiting list.</p>
          </>
        )}

        {status === "kept" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">No problem!</h1>
            <p className="text-muted-foreground font-body">You're still on the waiting list. We'll notify you when another slot opens up!</p>
          </>
        )}
      </div>
    </div>
  );
};

export default DeclineBooking;

```

### `src/pages/Index.tsx`

```tsx
import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import SectionDivider from "@/components/SectionDivider";
import ServicesSection from "@/components/ServicesSection";
import TeamSection from "@/components/TeamSection";
import ReviewsSection from "@/components/ReviewsSection";
import AboutSection from "@/components/AboutSection";
import HoursLocationSection from "@/components/HoursLocationSection";
import FooterSection from "@/components/FooterSection";
import CursorGlow from "@/components/CursorGlow";
import ScrollReveal from "@/components/ScrollReveal";
import GoldLine from "@/components/GoldLine";
import BookingModal from "@/components/BookingModal";
import AuthModal from "@/components/AuthModal";

const Index = () => {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [preselectedBarber, setPreselectedBarber] = useState<string | undefined>();

  const openAuth = (barberName?: string) => {
    setPreselectedBarber(barberName);
    setAuthOpen(true);
  };

  const handleAuthContinue = () => {
    setAuthOpen(false);
    setBookingOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <CursorGlow />
      <Navbar onBookNow={() => openAuth()} />
      <HeroSection onBookNow={() => openAuth()} />
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <ServicesSection onBookNow={() => openAuth()} />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <TeamSection onBookWithBarber={(name) => openAuth(name)} />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <ReviewsSection />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <AboutSection />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal>
        <GoldLine />
        <HoursLocationSection />
      </ScrollReveal>
      <SectionDivider />
      <FooterSection />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} onContinue={handleAuthContinue} />
      <BookingModal open={bookingOpen} onOpenChange={setBookingOpen} preselectedBarber={preselectedBarber} />
    </div>
  );
};

export default Index;

```

### `src/pages/NotFound.tsx`

```tsx
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;

```

### `src/pages/WaitingListAccept.tsx`

```tsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WaitingListAccept = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const processAccept = async () => {
      const id = params.get("id");
      const date = params.get("date");
      const time = params.get("time");
      const barberId = params.get("barber_id");
      const serviceId = params.get("service_id");
      const name = params.get("name");
      const email = params.get("email");
      const phone = params.get("phone");

      if (!id || !date || !time || !barberId || !name) {
        setErrorMsg("Invalid link.");
        setStatus("error");
        return;
      }

      // Check if waiting list entry still exists and is valid
      const { data: entry } = await supabase
        .from("waiting_list")
        .select("*")
        .eq("id", id)
        .single();

      if (!entry || entry.status === "cancelled" || entry.status === "declined" || entry.status === "accepted") {
        setErrorMsg("This link has expired or already been used.");
        setStatus("error");
        return;
      }

      // Check if the slot is still available
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("barber_id", barberId)
        .eq("appointment_date", date)
        .eq("time_slot", time)
        .in("status", ["booked", "confirmed"]);

      if (existing && existing.length > 0) {
        setErrorMsg("Sorry, this slot has already been taken.");
        setStatus("error");
        // Update waiting list status
        await supabase.from("waiting_list").update({ status: "cancelled" }).eq("id", id);
        return;
      }

      // Book the appointment
      const { error: bookError } = await supabase.from("appointments").insert({
        barber_id: barberId,
        service_id: serviceId || barberId, // fallback
        appointment_date: date,
        time_slot: time,
        client_name: name,
        client_email: email || null,
        client_phone: phone || null,
      });

      if (bookError) {
        console.error(bookError);
        setErrorMsg("Error booking appointment. Please try again.");
        setStatus("error");
        return;
      }

      // Update waiting list status
      await supabase.from("waiting_list").update({ status: "accepted" }).eq("id", id);

      setStatus("success");

      // Redirect after 3 seconds
      setTimeout(() => navigate("/"), 3000);
    };

    processAccept();
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-accent animate-spin" />
            <p className="text-foreground font-body text-lg">Processing your booking...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">Your appointment has been booked!</h1>
            <p className="text-muted-foreground font-body">See you soon 🎉</p>
            <p className="text-muted-foreground font-body text-sm">Redirecting in 3 seconds...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="font-serif text-2xl text-foreground">Oops!</h1>
            <p className="text-muted-foreground font-body">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default WaitingListAccept;

```

### `src/pages/WaitingListDecline.tsx`

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WaitingListDecline = () => {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const processDecline = async () => {
      const id = params.get("id");
      if (!id) { setDone(true); return; }

      await supabase.from("waiting_list").update({ status: "declined" }).eq("id", id);
      setDone(true);
    };
    processDecline();
  }, [params]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {!done ? (
          <Loader2 className="w-16 h-16 mx-auto text-accent animate-spin" />
        ) : (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-[#4A7C2F]/20 flex items-center justify-center">
              <Check size={40} className="text-[#4A7C2F]" />
            </div>
            <h1 className="font-serif text-2xl text-foreground">No problem!</h1>
            <p className="text-muted-foreground font-body">Your spot has been removed from the waiting list.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default WaitingListDecline;

```

### `src/styles/no-zoom.css`

```css
input,
input:focus,
input[type],
input[type]:focus,
select,
select:focus,
textarea,
textarea:focus {
  font-size: 16px !important;
  transform: scale(1) !important;
  -webkit-transform: scale(1) !important;
}

```

### `src/test/example.test.ts`

```typescript
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});

```

### `src/test/setup.ts`

```typescript
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

```

### `src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />

```

### `supabase/config.toml`

```toml
project_id = "eaxwchvdzdbivqxoufao"
```

### `tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        gold: "hsl(var(--gold))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

```

### `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "lib": [
      "ES2020",
      "DOM",
      "DOM.Iterable"
    ],
    "module": "ESNext",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "noEmit": true,
    "noFallthroughCasesInSwitch": false,
    "noImplicitAny": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "paths": {
      "@/*": [
        "./src/*"
      ]
    },
    "skipLibCheck": true,
    "strict": false,
    "target": "ES2020",
    "types": [
      "vitest/globals"
    ],
    "useDefineForClassFields": true
  },
  "include": [
    "src"
  ]
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "allowJs": true,
    "noImplicitAny": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "paths": {
      "@/*": [
        "./src/*"
      ]
    },
    "skipLibCheck": true,
    "strictNullChecks": false
  },
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
```

### `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));

```

---
## 5. Step-by-Step Installation Guide

### Prerequisites
- Node.js 18+ or Bun
- A Supabase project (or Lovable Cloud)
- Vonage account (for SMS)
- Twilio account (for voice calls)
- EmailJS account (for email notifications)

### Steps

1. **Clone the project** and install dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

2. **Set up Supabase database**: Run the SQL from Section 2 in your Supabase SQL Editor to create all tables, functions, views, and RLS policies.

3. **Create the first admin user**:
   - Sign up a user via Supabase Auth dashboard
   - Insert their `user_id` into `admin_users` table:
     ```sql
     INSERT INTO admin_users (user_id) VALUES ('<user-uuid>');
     ```

4. **Create barber accounts**: Log into the admin portal (`/admin`) and use the "Add Barber" form. This creates both the auth user and the barber record.

5. **Set up Edge Function secrets** in Supabase dashboard → Edge Functions → Secrets:
   - `VONAGE_API_KEY` and `VONAGE_API_SECRET` (for SMS)
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (for voice calls)

6. **Set up EmailJS**:
   - Create an account at emailjs.com
   - Create a service and templates for: booking confirmation (client), booking notification (owner), and waiting list notification
   - Update the EmailJS public key, service ID, and template IDs in `BookingModal.tsx` and `waitingListNotifier.ts`

7. **Configure environment variables** in `.env`:
   ```env
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
   VITE_SUPABASE_PROJECT_ID=<ref>
   ```

8. **Deploy Edge Functions** (if not on Lovable Cloud):
   ```bash
   supabase functions deploy send-sms
   supabase functions deploy make-call
   supabase functions deploy book-appointment
   supabase functions deploy send-reminders
   supabase functions deploy admin-actions
   ```

9. **Set up automated reminders** (Supabase Cron):
   ```sql
   SELECT cron.schedule('send-2h-reminders', '*/30 * * * *',
     $$SELECT net.http_post(url:='https://<ref>.supabase.co/functions/v1/send-reminders',
       body:='{"hoursAhead": 2}'::jsonb,
       headers:='{"Authorization": "Bearer <service-role-key>"}'::jsonb)$$);
   
   SELECT cron.schedule('send-24h-reminders', '0 * * * *',
     $$SELECT net.http_post(url:='https://<ref>.supabase.co/functions/v1/send-reminders',
       body:='{"hoursAhead": 24}'::jsonb,
       headers:='{"Authorization": "Bearer <service-role-key>"}'::jsonb)$$);
   ```

10. **Populate initial data**:
    - Add services via the admin portal
    - Add opening hours via the admin portal (site_content → hours)
    - Add contact info (site_content → contact)
    - Add reviews

11. **Build and deploy**:
    ```bash
    npm run build
    # Deploy the `dist/` folder to your hosting (Vercel, Netlify, etc.)
    ```

### Routes
| Route | Description |
|---|---|
| `/` | Main client-facing website with booking |
| `/barber` | Barber portal (login required) |
| `/admin` | Admin portal (login required) |
| `/accept-booking` | Waiting list accept link |
| `/decline-booking` | Waiting list decline link |
| `/waiting-list/accept` | Alternative waiting list accept |
| `/waiting-list/decline` | Alternative waiting list decline |

---
## 6. Customization Prompt Template

Copy and paste this prompt into Lovable (or any AI assistant) to adapt the system for a new barbershop:

---

```
I have the House of Fades barbershop booking system built with React + Supabase. I need to customize it for a new barbershop with the following details:

**Shop Details:**
- Shop name: [YOUR SHOP NAME]
- Location: [FULL ADDRESS]
- City/Country: [CITY, COUNTRY]
- Phone: [PHONE NUMBER]
- Email: [EMAIL]
- Social media: [INSTAGRAM/FACEBOOK URLs]

**Team:**
- Barber 1: [NAME] — [ROLE, e.g. "Senior Barber"]
- Barber 2: [NAME] — [ROLE]
- (add more as needed)

**Services & Pricing:**
- [SERVICE NAME] — €[PRICE] — [DURATION] min
- (add more as needed)

**Opening Hours:**
- Monday: [TIME or "Closed"]
- Tuesday: [TIME]
- Wednesday: [TIME]
- Thursday: [TIME]
- Friday: [TIME]
- Saturday: [TIME]
- Sunday: [TIME]

**Branding:**
- Primary colour: [HEX or description]
- Accent colour: [HEX or description]
- Style preference: [e.g. "dark luxury", "clean modern", "vintage", "urban street"]
- Logo: [describe or attach]

**Notifications:**
- SMS provider: [Vonage / Twilio / other]
- Email provider: [EmailJS / SendGrid / other]
- Voice calls: [Yes/No]
- Languages needed: [e.g. English, Portuguese]

**Google Maps embed:**
- Google Maps link: [LINK]

Please update:
1. All branding (shop name, colours, fonts, logo)
2. Team members in TeamSection.tsx
3. Default opening hours in HoursLocationSection.tsx
4. Google Maps iframe URL
5. Footer contact details and social links
6. index.html meta tags (title, description, OG tags)
7. Translation strings in translations.ts
8. EmailJS template IDs if changed
9. SMS sender name (currently "HouseOfFades" in send-sms edge function)
10. Calendar download shop name in calendarDownload.ts
```
