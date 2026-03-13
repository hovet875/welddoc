import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";

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

function cacheSession(session: Session | null) {
  cachedSession = { value: session, ts: Date.now() };
  return session;
}

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

export async function getProfileAccess(
  user: User
): Promise<{ isAdmin: boolean; loginEnabled: boolean; displayName: string }> {
  if (cachedAccess && cachedAccess.userId === user.id && Date.now() - cachedAccess.ts < ACCESS_TTL_MS) {
    return cachedAccess.value;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("login_enabled, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    const value = {
      isAdmin: false,
      loginEnabled: false,
      displayName: "Bruker",
    };
    cachedAccess = { userId: user.id, value, ts: Date.now() };
    return value;
  }

  const value = {
    isAdmin: profile.role === "admin",
    loginEnabled: profile.login_enabled ?? false,
    displayName: profile.display_name ?? "Bruker",
  };

  cachedAccess = { userId: user.id, value, ts: Date.now() };
  return value;
}

export async function getIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;

  try {
    const access = await getProfileAccess(data.user);
    return access.isAdmin;
  } catch {
    return false;
  }
}

async function readSessionFromSupabase() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return cacheSession(data.session);
}

async function refreshCurrentSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return cacheSession(data.session);
}

export async function getSession() {
  if (cachedSession && Date.now() - cachedSession.ts < SESSION_TTL_MS) {
    return cachedSession.value;
  }

  return readSessionFromSupabase();
}

export async function getAccessToken() {
  const tokenErrorMessage = "Kunne ikke hente tilgangstoken. Prøv igjen eller logg inn på nytt.";

  try {
    const session = await getSession();
    const token = session?.access_token?.trim();
    if (token) return token;
  } catch {}

  try {
    const refreshedSession = await refreshCurrentSession();
    const refreshedToken = refreshedSession?.access_token?.trim();
    if (refreshedToken) return refreshedToken;
  } catch {}

  throw new Error(tokenErrorMessage);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;

  const userId = data.session?.user?.id;
  const userEmail = data.session?.user?.email ?? null;
  if (userId && userEmail) {
    try {
      await supabase.from("profiles").update({ email: userEmail }).eq("id", userId);
    } catch (err) {
      console.warn("Failed to sync profile email", err);
    }
  }

  cacheSession(data.session);
  cachedAccess = null;
  return data.session;
}

export async function signOut() {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } finally {
    clearAuthStorage();
    cacheSession(null);
    cachedAccess = null;
  }
}
