import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJobTitles } from "../../../../../repo/jobTitleRepo";
import { supabase } from "../../../../../services/supabaseClient";
import type { UsersDataState } from "../users.types";

type UseUsersDataArgs = {
  enabled: boolean;
};

type UseUsersDataResult = UsersDataState & {
  reload: () => Promise<void>;
};

const INITIAL_STATE: UsersDataState = {
  loading: false,
  error: null,
  rows: [],
  jobTitles: [],
};

export function useUsersData({ enabled }: UseUsersDataArgs): UseUsersDataResult {
  const [state, setState] = useState<UsersDataState>(INITIAL_STATE);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) {
      setState(INITIAL_STATE);
      return;
    }

    const seq = ++loadSeqRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [jobTitles, usersResult] = await Promise.all([
        (async () => {
          try {
            return await fetchJobTitles();
          } catch (err) {
            console.warn("Feilet å hente stillinger", err);
            return [];
          }
        })(),
        supabase
          .from("profiles")
          .select("id, display_name, email, welder_no, job_title, role, login_enabled")
          .order("display_name", { ascending: true }),
      ]);

      if (seq !== loadSeqRef.current) return;

      if (usersResult.error) {
        setState({
          loading: false,
          error: usersResult.error.message,
          rows: [],
          jobTitles,
        });
        return;
      }

      setState({
        loading: false,
        error: null,
        rows: (usersResult.data ?? []) as UsersDataState["rows"],
        jobTitles,
      });
    } catch (err: any) {
      if (seq !== loadSeqRef.current) return;
      setState({
        loading: false,
        error: err?.message ?? "Kunne ikke hente brukere.",
        rows: [],
        jobTitles: [],
      });
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    ...state,
    reload,
  };
}
