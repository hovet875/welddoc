import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJobTitles, type JobTitleRow } from "../../../../repo/jobTitleRepo";
import { supabase } from "../../../../services/supabaseClient";
import { profileToForm, sanitizeWelderNo } from "../lib/profile";
import type { SettingsDataState, SettingsFormState, SettingsProfileRow } from "../settings.types";

type UseSettingsDataArgs = {
  userId: string | null;
  fallbackDisplayName: string;
};

type UseSettingsDataResult = SettingsDataState & {
  setDisplayName: (value: string) => void;
  setJobTitle: (value: string) => void;
  setWelderNo: (value: string) => void;
  reload: () => Promise<void>;
  save: () => Promise<void>;
};

const EMPTY_FORM: SettingsFormState = {
  displayName: "",
  jobTitle: "",
  welderNo: "",
};

export function useSettingsData({ userId, fallbackDisplayName }: UseSettingsDataArgs): UseSettingsDataResult {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(false);
  const [jobTitles, setJobTitles] = useState<JobTitleRow[]>([]);
  const [form, setForm] = useState<SettingsFormState>(EMPTY_FORM);
  const loadSeqRef = useRef(0);
  const hasLoadedProfileRef = useRef(false);

  const reload = useCallback(async () => {
    const seq = ++loadSeqRef.current;

    setLoading(true);
    setError(null);
    setCanSave(false);
    setForm((prev) => ({ ...prev, displayName: prev.displayName || fallbackDisplayName }));

    try {
      const [profileResult, titlesResult] = await Promise.all([
        (async () => {
          if (!userId) return null;
          const { data, error } = await supabase
            .from("profiles")
            .select("display_name, welder_no, job_title")
            .eq("id", userId)
            .maybeSingle();
          if (error) throw error;
          return (data ?? null) as SettingsProfileRow | null;
        })(),
        (async () => {
          try {
            return await fetchJobTitles();
          } catch (err) {
            console.warn("Feilet å hente stillinger", err);
            return [];
          }
        })(),
      ]);

      if (seq !== loadSeqRef.current) return;

      setJobTitles(titlesResult);

      if (!userId) {
        setForm((prev) => ({ ...prev, displayName: prev.displayName || fallbackDisplayName }));
        setError("Fant ingen innlogget brukerprofil.");
        setCanSave(false);
        return;
      }

      if (!profileResult) {
        setError("Kunne ikke finne brukerprofilen din. Prøv igjen.");
        setCanSave(false);
        return;
      }

      hasLoadedProfileRef.current = true;
      setForm(profileToForm(profileResult, fallbackDisplayName));
      setCanSave(true);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : "Kunne ikke laste brukerprofilen.");
      setCanSave(false);
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [fallbackDisplayName, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setDisplayName = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, displayName: value }));
  }, []);

  const setJobTitle = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, jobTitle: value }));
  }, []);

  const setWelderNo = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, welderNo: value }));
  }, []);

  const save = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedProfileRef.current || !canSave) {
      throw new Error("Brukerprofilen er ikke lastet korrekt. Prøv å laste siden på nytt.");
    }

    setSaving(true);
    try {
      const payload = {
        display_name: form.displayName.trim() || null,
        welder_no: sanitizeWelderNo(form.welderNo),
        job_title: form.jobTitle.trim() || null,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (error) throw error;
    } finally {
      setSaving(false);
    }
  }, [canSave, form.displayName, form.jobTitle, form.welderNo, userId]);

  return {
    loading,
    saving,
    error,
    canSave,
    jobTitles,
    form,
    setDisplayName,
    setJobTitle,
    setWelderNo,
    reload,
    save,
  };
}
