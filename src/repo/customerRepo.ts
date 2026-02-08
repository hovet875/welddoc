import { supabase } from "../services/supabaseClient";

export type CustomerRow = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export async function fetchCustomers(opts?: { includeInactive?: boolean }): Promise<CustomerRow[]> {
  let query = supabase
    .from("parameter_customers")
    .select("id, name, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CustomerRow[];
}

export async function createCustomer(name: string) {
  const { error } = await supabase.from("parameter_customers").insert({ name });
  if (error) throw error;
}

export async function updateCustomer(id: string, name: string) {
  const { error } = await supabase.from("parameter_customers").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from("parameter_customers").delete().eq("id", id);
  if (error) throw error;
}
