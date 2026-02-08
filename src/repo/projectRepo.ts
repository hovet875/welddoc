import { supabase } from "../services/supabaseClient";

export type ProjectRow = {
  id: string;
  project_no: number;
  work_order: string;
  customer: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export async function fetchProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, project_no, work_order, customer, name, is_active, created_at")
    .order("is_active", { ascending: false })
    .order("project_no", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

export async function fetchProjectById(id: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, project_no, work_order, customer, name, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ProjectRow | null;
}

export async function createProject(input: {
  project_no: number;
  work_order: string;
  customer: string;
  name: string;
  is_active: boolean;
}) {
  const payload: Omit<ProjectRow, "id" | "created_at"> = {
    project_no: input.project_no,
    work_order: input.work_order,
    customer: input.customer,
    name: input.name,
    is_active: input.is_active,
  };
  const { error } = await supabase.from("projects").insert(payload);
  if (error) throw error;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<ProjectRow, "project_no" | "work_order" | "customer" | "name" | "is_active">>
) {
  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
