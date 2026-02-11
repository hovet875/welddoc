import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

function readRememberMe() {
  try {
    const remember = localStorage.getItem("rememberMe");
    return remember === null ? true : remember === "true";
  } catch {
    return true;
  }
}

function getPreferredStorage() {
  return readRememberMe() ? localStorage : sessionStorage;
}

function getFallbackStorage() {
  return readRememberMe() ? sessionStorage : localStorage;
}

const authStorage = {
  getItem(key: string) {
    try {
      const preferred = getPreferredStorage().getItem(key);
      if (preferred !== null) return preferred;
    } catch {}

    try {
      return getFallbackStorage().getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      getPreferredStorage().setItem(key, value);
    } catch {}
    try {
      getFallbackStorage().removeItem(key);
    } catch {}
  },
  removeItem(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
});
