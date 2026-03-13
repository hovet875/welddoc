import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getProfileAccess, getSession } from "@/auth/authClient";
import { supabase } from "../../services/supabaseClient";
import { signOutSafely } from "./logout";

type AccessInfo = Awaited<ReturnType<typeof getProfileAccess>>;
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  access: AccessInfo | null;
  message: string | null;
};

type AuthContextValue = AuthState & {
  clearMessage: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  status: "loading",
  session: null,
  access: null,
  message: null,
};

const TRANSIENT_ACCESS_MESSAGE = "Kunne ikke verifisere tilgang akkurat nå. Kontroller nettverket og prøv igjen.";
const TRANSIENT_SESSION_MESSAGE = "Kunne ikke oppdatere innloggingsstatus akkurat nå. Kontroller nettverket og prøv igjen.";
const INITIAL_SESSION_MESSAGE = "Kunne ikke hente innloggingsstatus akkurat nå. Kontroller nettverket og prøv igjen.";

async function safeSignOut() {
  await signOutSafely("Utlogging feilet");
}

type SyncOptions = {
  setLoading: boolean;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  const syncFromSession = useCallback(async (session: Session | null, options: SyncOptions) => {
    const runId = ++runIdRef.current;
    if (options.setLoading && mountedRef.current) {
      setState((prev) => ({ ...prev, status: "loading" }));
    }

    if (!session) {
      if (!mountedRef.current || runId !== runIdRef.current) return;
      setState((prev) => ({
        status: "unauthenticated",
        session: null,
        access: null,
        message: prev.message,
      }));
      return;
    }

    try {
      const access = await getProfileAccess(session.user);
      if (!mountedRef.current || runId !== runIdRef.current) return;

      if (!access.loginEnabled) {
        await safeSignOut();
        if (!mountedRef.current || runId !== runIdRef.current) return;
        setState({
          status: "unauthenticated",
          session: null,
          access: null,
          message: "Tilgangen din er deaktivert. Kontakt admin.",
        });
        return;
      }

      setState({
        status: "authenticated",
        session,
        access,
        message: null,
      });
    } catch (err) {
      console.warn("Profile access check failed", err);
      if (!mountedRef.current || runId !== runIdRef.current) return;
      setState((prev) => ({
        status: "authenticated",
        session,
        access: prev.session?.user.id === session.user.id ? prev.access : null,
        message: TRANSIENT_ACCESS_MESSAGE,
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    let session: Session | null = null;
    try {
      session = await getSession();
    } catch (err) {
      console.warn("getSession failed", err);
      if (!mountedRef.current) return;
      setState((prev) => {
        if (prev.session) {
          return {
            ...prev,
            status: "authenticated",
            message: TRANSIENT_SESSION_MESSAGE,
          };
        }

        return {
          status: "unauthenticated",
          session: null,
          access: null,
          message: INITIAL_SESSION_MESSAGE,
        };
      });
      return;
    }
    await syncFromSession(session, { setLoading: true });
  }, [syncFromSession]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncFromSession(session, { setLoading: false });
    });

    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      data.subscription.unsubscribe();
    };
  }, [refresh, syncFromSession]);

  const clearMessage = useCallback(() => {
    setState((prev) => ({ ...prev, message: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      clearMessage,
      refresh,
    }),
    [clearMessage, refresh, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
