import { supabase } from "../services/supabaseClient";

export type JobTitleRow = {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
};

export async function fetchJobTitles(): Promise<JobTitleRow[]> {
  const { data, error } = await supabase
    .from("parameter_job_titles")
    .select("id, title, is_active, created_at")
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as JobTitleRow[];
}

export async function createJobTitle(title: string) {
  const { error } = await supabase.from("parameter_job_titles").insert({ title });
  if (error) throw error;
}

export async function updateJobTitle(id: string, title: string) {
  const { error } = await supabase.from("parameter_job_titles").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteJobTitle(id: string) {
  const { error } = await supabase.from("parameter_job_titles").delete().eq("id", id);
  if (error) throw error;
}
