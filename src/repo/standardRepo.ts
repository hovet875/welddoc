import { supabase } from "../services/supabaseClient";

export type StandardRow = {
  id: string;
  label: string;
  description: string | null;
  revision: number | null;
  has_fm_group: boolean;
  type: string | null;
  sort_order: number;
  created_at: string;
};

export type StandardFmGroupRow = {
  id: string;
  standard_id: string;
  label: string;
  sort_order: number;
  created_at: string;
};

export async function fetchStandards() {
  const { data, error } = await supabase
    .from("parameter_standards")
    .select("id, label, description, revision, has_fm_group, type, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })
    .order("revision", { ascending: true, nullsFirst: true });

  if (error) throw error;
  return (data ?? []) as StandardRow[];
}

export async function createStandard(input: {
  label: string;
  description?: string | null;
  revision?: number | null;
  type?: string | null;
  sort_order?: number;
}) {
  const { error } = await supabase
    .from("parameter_standards")
    .insert({
      label: input.label,
      description: input.description ?? null,
      revision: input.revision ?? null,
      type: input.type ?? null,
      sort_order: input.sort_order ?? 0,
    });
  if (error) throw error;
}

export async function updateStandard(
  id: string,
  patch: Partial<Pick<StandardRow, "label" | "description" | "revision" | "type" | "sort_order">>
) {
  const { error } = await supabase.from("parameter_standards").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteStandard(id: string) {
  const { error } = await supabase.from("parameter_standards").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchStandardFmGroups(standardId?: string) {
  let q = supabase
    .from("parameter_standard_fm_groups")
    .select("id, standard_id, label, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (standardId) q = q.eq("standard_id", standardId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StandardFmGroupRow[];
}

export async function createStandardFmGroup(input: { standard_id: string; label: string; sort_order?: number }) {
  const { error } = await supabase
    .from("parameter_standard_fm_groups")
    .insert({
      standard_id: input.standard_id,
      label: input.label,
      sort_order: input.sort_order ?? 0,
    });
  if (error) throw error;
}

export async function updateStandardFmGroup(
  id: string,
  patch: Partial<Pick<StandardFmGroupRow, "label" | "sort_order">>
) {
  const { error } = await supabase.from("parameter_standard_fm_groups").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteStandardFmGroup(id: string) {
  const { error } = await supabase.from("parameter_standard_fm_groups").delete().eq("id", id);
  if (error) throw error;
}
