import type { JobTitleRow } from "../../../repo/jobTitleRepo";

export type SettingsProfileRow = {
  display_name: string | null;
  welder_no: string | null;
  job_title: string | null;
};

export type SettingsFormState = {
  displayName: string;
  jobTitle: string;
  welderNo: string;
};

export type SettingsDataState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  canSave: boolean;
  jobTitles: JobTitleRow[];
  form: SettingsFormState;
};
