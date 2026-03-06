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
  const [jobTitles, setJobTitles] = useState<JobTitleRow[]>([]);
  const [form, setForm] = useState<SettingsFormState>(EMPTY_FORM);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const seq = ++loadSeqRef.current;

    setLoading(true);
    setForm((prev) => ({ ...prev, displayName: prev.displayName || fallbackDisplayName }));

    void (async () => {
      try {
        const [profileResult, titlesResult] = await Promise.all([
          (async () => {
            if (!userId) return null;
            const { data } = await supabase
              .from("profiles")
              .select("display_name, welder_no, job_title")
              .eq("id", userId)
              .maybeSingle();
            return (data ?? null) as SettingsProfileRow | null;
          })(),
          (async () => {
            try {
              return await fetchJobTitles();
            } catch (err) {
              console.warn("Feilet \u00e5 hente stillinger", err);
              return [];
            }
          })(),
        ]);

        if (cancelled || seq !== loadSeqRef.current) return;
        setJobTitles(titlesResult);
        setForm(profileToForm(profileResult, fallbackDisplayName));
      } finally {
        if (cancelled || seq !== loadSeqRef.current) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackDisplayName, userId]);

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
  }, [form.displayName, form.jobTitle, form.welderNo, userId]);

  return {
    loading,
    saving,
    jobTitles,
    form,
    setDisplayName,
    setJobTitle,
    setWelderNo,
    save,
  };
}
