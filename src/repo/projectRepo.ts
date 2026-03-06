import { supabase } from "../services/supabaseClient";
import { getRangeFromPage, normalizePageRequest, type PageResult } from "./pagination";

export type ProjectRow = {
  id: string;
  project_no: number;
  work_order: string;
  customer: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type ProjectListFilters = {
  status?: "" | "active" | "inactive";
  customer?: string | null;
  text?: string | null;
  isAdmin?: boolean;
};

function escapeLikeValue(value: string) {
  return value.replace(/[%_,]/g, (match) => `\\${match}`);
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, project_no, work_order, customer, name, is_active, created_at")
    .order("is_active", { ascending: false })
    .order("project_no", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

export async function fetchProjectPage(input: {
  page?: number;
  pageSize?: number;
  filters?: ProjectListFilters;
}): Promise<PageResult<ProjectRow>> {
  const { page, pageSize } = normalizePageRequest(input, { page: 1, pageSize: 25 });
  const { from, to } = getRangeFromPage(page, pageSize);
  const filters = input.filters ?? {};
  const status = String(filters.status ?? "").trim();
  const customer = String(filters.customer ?? "").trim();
  const text = String(filters.text ?? "").trim();
  const isAdmin = filters.isAdmin ?? false;

  let query = supabase
    .from("projects")
    .select("id, project_no, work_order, customer, name, is_active, created_at", { count: "exact" });

  if (!isAdmin || status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  }

  if (customer) {
    query = query.eq("customer", customer);
  }

  if (text) {
    const escaped = escapeLikeValue(text);
    const numeric = Number.parseInt(text, 10);
    const clauses = [
      `work_order.ilike.%${escaped}%`,
      `customer.ilike.%${escaped}%`,
      `name.ilike.%${escaped}%`,
    ];
    if (Number.isFinite(numeric) && String(numeric) === text) {
      clauses.unshift(`project_no.eq.${numeric}`);
    }
    query = query.or(clauses.join(","));
  }

  const { data, error, count } = await query
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    items: (data ?? []) as ProjectRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
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
