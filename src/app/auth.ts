import { supabase } from "../services/supabaseClient";
import type { User } from "@supabase/supabase-js";

/* -------------------- caching -------------------- */

let cachedSession: {
  value: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null;
  ts: number;
} | null = null;

let cachedAccess:
  | {
      userId: string;
      value: { isAdmin: boolean; loginEnabled: boolean; displayName: string };
      ts: number;
    }
  | null = null;

const SESSION_TTL_MS = 4000;
const ACCESS_TTL_MS = 15000;

/* -------------------- helpers -------------------- */

function clearAuthStorage() {
  const clearFrom = (storage: Storage) => {
    for (const key of Object.keys(storage)) {
      if (/^sb-.*-auth-token$/i.test(key) || /supabase\.auth\.token/i.test(key)) {
        storage.removeItem(key);
      }
    }
  };

  try {
    clearFrom(localStorage);
  } catch {}
  try {
    clearFrom(sessionStorage);
  } catch {}
}

/* -------------------- MAIN ACCESS LOGIC -------------------- */

export async function getProfileAccess(
  user: User
): Promise<{ isAdmin: boolean; loginEnabled: boolean; displayName: string }> {
  if (
    cachedAccess &&
    cachedAccess.userId === user.id &&
    Date.now() - cachedAccess.ts < ACCESS_TTL_MS
  ) {
    return cachedAccess.value;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("login_enabled, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.warn("Feilet å hente profil", profileError);
  }

  const value = {
    isAdmin: profile?.role === "admin",
    loginEnabled: profile?.login_enabled ?? true,
    displayName: profile?.display_name ?? "Bruker",
  };

  cachedAccess = { userId: user.id, value, ts: Date.now() };
  return value;
}

/* -------------------- helpers used elsewhere -------------------- */

export async function getIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  const access = await getProfileAccess(data.user);
  return access.isAdmin;
}

export async function getSession() {
  if (cachedSession && Date.now() - cachedSession.ts < SESSION_TTL_MS) {
    return cachedSession.value;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) return null;

  cachedSession = { value: data.session, ts: Date.now() };
  return data.session;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;

  // keep profiles.email in sync
  const userId = data.session?.user?.id;
  const userEmail = data.session?.user?.email ?? null;
  if (userId && userEmail) {
    try {
      await supabase.from("profiles").update({ email: userEmail }).eq("id", userId);
    } catch (err) {
      console.warn("Failed to sync profile email", err);
    }
  }

  cachedSession = { value: data.session, ts: Date.now() };
  cachedAccess = null;
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut({ scope: "global" });
  clearAuthStorage();
  cachedSession = { value: null, ts: Date.now() };
  cachedAccess = null;
}
