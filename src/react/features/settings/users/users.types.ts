import type { JobTitleRow } from "../../../../repo/jobTitleRepo";

export type UserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  welder_no: string | null;
  job_title: string | null;
  role: string | null;
  login_enabled: boolean | null;
};

export type UsersDataState = {
  loading: boolean;
  error: string | null;
  rows: UserRow[];
  jobTitles: JobTitleRow[];
};
