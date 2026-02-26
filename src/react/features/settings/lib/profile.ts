import type { SettingsFormState, SettingsProfileRow } from "../settings.types";

export function formatWelderNo(value: string | null) {
  if (!value) return "";
  return String(value).padStart(3, "0");
}

export function sanitizeWelderNo(value: string) {
  const raw = value.replace(/\D/g, "").trim();
  return raw ? raw.padStart(3, "0") : null;
}

export function profileToForm(profile: SettingsProfileRow | null, fallbackDisplayName: string): SettingsFormState {
  return {
    displayName: profile?.display_name ?? fallbackDisplayName,
    jobTitle: profile?.job_title ?? "",
    welderNo: formatWelderNo(profile?.welder_no ?? null),
  };
}
