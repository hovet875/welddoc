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
    const userId = String(body.userId ?? "").trim();
    const password = String(body.password ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!userId) return json(400, { error: "userId mangler" });
    if (!password && !email) {
      return json(400, { error: "Mangler e-post eller passord" });
    }
    if (password && password.length < 6) {
      return json(400, { error: "Passord må være minst 6 tegn" });
    }
    if (email && !email.includes("@")) {
      return json(400, { error: "Ugyldig e-post" });
    }

    const updatePayload: { password?: string; email?: string; email_confirm?: boolean } = {};
    if (password) updatePayload.password = password;
    if (email) {
      updatePayload.email = email;
      updatePayload.email_confirm = true;
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updatePayload);
    if (updateError) return json(400, { error: updateError.message });

    if (email) {
      const { error: profileError } = await adminClient.from("profiles").update({ email }).eq("id", userId);
      if (profileError) return json(400, { error: profileError.message });
    }

    return json(200, { ok: true });
  } catch (err: any) {
    return json(500, { error: String(err?.message ?? err) });
  }
});
