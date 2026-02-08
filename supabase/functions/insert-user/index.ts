// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // ✅ Preflight først, alltid 204/200 og aldri noe annet
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase environment variables" });
    }

    if (req.method !== "POST") return json(405, { error: "Metode ikke tillatt" });

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json(401, { error: "Uautorisert (mangler Authorization)" });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json(401, { error: "Uautorisert (ugyldig token)" });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: roleRow, error: roleError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (roleError || roleRow?.role !== "admin") return json(403, { error: "Forbudt" });

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) return json(400, { error: "E-post er påkrevd" });

    const display_name = String(body.display_name ?? "").trim() || null;
    const job_title = String(body.job_title ?? "").trim() || null;
    const role = String(body.role ?? "user").trim() || "user";
    const password = String(body.password ?? "");
    if (!password || password.length < 6) {
      return json(400, { error: "Passord må være minst 6 tegn" });
    }
    const welder_no_raw = String(body.welder_no ?? "").replace(/\D/g, "").trim();
    const welder_no = welder_no_raw ? welder_no_raw.padStart(3, "0") : null;

    const { data: createdData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) return json(400, { error: createError.message });

    const createdUserId = createdData?.user?.id;
    if (!createdUserId) return json(500, { error: "Kunne ikke opprette bruker" });

    const { error: upsertError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: createdUserId,
          email,
          display_name,
          job_title,
          welder_no,
          role,
          login_enabled: true,
        },
        { onConflict: "id" }
      );

    if (upsertError) return json(400, { error: upsertError.message });

    return json(200, { ok: true, user_id: createdUserId });
  } catch (err: any) {
    return json(500, { error: String(err?.message ?? err) });
  }
});
