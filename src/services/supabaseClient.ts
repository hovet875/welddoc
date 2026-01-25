import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getStorage() {
  // default: husk meg = true
  const remember = localStorage.getItem("rememberMe");
  const rememberMe = remember === null ? true : remember === "true";
  return rememberMe ? localStorage : sessionStorage;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: getStorage(),
  },
});