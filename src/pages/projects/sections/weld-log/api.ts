import { supabase } from "../../../../services/supabaseClient";
import type { ListFilters, ListResult, NdtReportRow, WeldDetailRow, WeldListRow } from "./types";

const BASE_SELECT = `
  id,
  sveis_id:weld_no,
  fuge:joint_type,
  sveiser_id:welder_id,
  dato:weld_date,
  status,
  kontrollert_av:visual_inspector,
  updated_at:created_at,
  komponent_a:component_a_id (
    type_code,
    code_index
  ),
  komponent_b:component_b_id (
    type_code,
    code_index
  ),
  tilsett:filler_traceability_id (
    type_code,
    code_index
  ),
  wps:wps_id (
    doc_no
  ),
  vt_report_id:visual_inspector,
  pt_report_id:crack_report_id,
  vol_report_id:volumetric_report_id,
  sveiser:welder_id (
    id,
    display_name,
    welder_no
  )
`;

const DETAIL_SELECT = `
  ${BASE_SELECT},
  merknader,
  vt_comment,
  pt_comment,
  vol_comment,
  vt_date,
  pt_date,
  vol_date
`;

type RawWelder = { id: string; display_name: string | null; welder_no: string | null } | null;
type RawTrace = { type_code: string; code_index: number | null } | null;
type RawWps = { doc_no: string | null } | null;
type RawWeldRow = Omit<WeldListRow, "sveiser" | "komponent_a" | "komponent_b" | "tilsett" | "wps" | "godkjent"> & {
  sveiser?: RawWelder | RawWelder[] | null;
  komponent_a?: RawTrace | RawTrace[] | null;
  komponent_b?: RawTrace | RawTrace[] | null;
  tilsett?: RawTrace | RawTrace[] | null;
  wps?: RawWps | RawWps[] | null;
};

const normalizeWelder = (value: RawWelder | RawWelder[] | null | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const normalizeTrace = (value: RawTrace | RawTrace[] | null | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const normalizeWps = (value: RawWps | RawWps[] | null | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const buildTraceCode = (trace: RawTrace | null) => {
  if (!trace) return null;
  return `${trace.type_code}${trace.code_index ?? ""}`;
};

const normalizeWeldRow = (row: RawWeldRow): WeldListRow => {
  const komponentA = buildTraceCode(normalizeTrace(row.komponent_a));
  const komponentB = buildTraceCode(normalizeTrace(row.komponent_b));
  const tilsett = buildTraceCode(normalizeTrace(row.tilsett));
  const wps = normalizeWps(row.wps)?.doc_no ?? null;
  return {
    ...row,
    sveiser: normalizeWelder(row.sveiser),
    komponent_a: komponentA,
    komponent_b: komponentB,
    tilsett,
    wps,
    godkjent: row.status === "godkjent",
  };
};

const mapPatchToProjectWelds = (patch: Partial<WeldDetailRow>) => {
  const mapped: Record<string, unknown> = {};
  if (patch.sveis_id != null) {
    const next = typeof patch.sveis_id === "string" ? Number(patch.sveis_id) : patch.sveis_id;
    mapped.weld_no = Number.isFinite(next as number) ? next : null;
  }
  if (patch.fuge != null) mapped.joint_type = patch.fuge;
  if (patch.sveiser_id != null) mapped.welder_id = patch.sveiser_id;
  if (patch.dato != null) mapped.weld_date = patch.dato;
  if (patch.kontrollert_av != null) mapped.visual_inspector = patch.kontrollert_av;
  if (patch.pt_report_id != null) mapped.crack_report_id = patch.pt_report_id;
  if (patch.vol_report_id != null) mapped.volumetric_report_id = patch.vol_report_id;
  if (patch.status != null) mapped.status = patch.status;
  if (patch.godkjent != null && patch.status == null) {
    mapped.status = patch.godkjent ? "godkjent" : "kontroll";
  }
  return mapped;
};

export async function listWelds(opts: {
  page: number;
  pageSize: number;
  filters: ListFilters;
  orderBy: "weld_no" | "weld_date" | "created_at";
  orderDir: "asc" | "desc";
  logId?: string | null;
}): Promise<ListResult<WeldListRow>> {
  const { page, pageSize, filters, orderBy, orderDir, logId } = opts;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("project_welds")
    .select(BASE_SELECT, { count: "exact" })
    .order(orderBy, { ascending: orderDir === "asc", nullsFirst: false })
    .range(from, to);

  if (logId) {
    query = query.eq("log_id", logId);
  }

  if (filters.status === "godkjent") {
    query = query.eq("status", "godkjent");
  } else if (filters.status === "til-kontroll") {
    query = query.eq("status", "kontroll");
  } else if (filters.status === "avvist") {
    query = query.eq("status", "avvist");
  }

  const search = filters.search.trim();
  if (search) {
    const q = `%${search}%`;
    query = query.or(
      [
        `weld_no.ilike.${q}`,
        `joint_type.ilike.${q}`,
        `welder_id.ilike.${q}`,
        `crack_report_id.ilike.${q}`,
        `volumetric_report_id.ilike.${q}`,
      ].join(",")
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((row) => normalizeWeldRow(row as RawWeldRow));
  return { rows, count: count ?? 0 };
}

export async function getWeldDetail(id: string): Promise<WeldDetailRow> {
  const { data, error } = await supabase
    .from("project_welds")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeWeldRow(data as RawWeldRow) as WeldDetailRow;
}

export async function createWeld(input: { logId: string; patch: Partial<WeldDetailRow> }) {
  const mapped = mapPatchToProjectWelds(input.patch);
  if (mapped.weld_no == null) {
    throw new Error("Sveis ID mangler eller er ugyldig.");
  }
  const payload = {
    id: crypto.randomUUID(),
    log_id: input.logId,
    weld_no: mapped.weld_no as number,
    joint_type: mapped.joint_type ?? null,
    welder_id: mapped.welder_id ?? null,
    weld_date: mapped.weld_date ?? null,
    visual_inspector: mapped.visual_inspector ?? null,
    crack_report_id: mapped.crack_report_id ?? null,
    volumetric_report_id: mapped.volumetric_report_id ?? null,
    status: mapped.status ?? "kontroll",
  };
  const { error } = await supabase.from("project_welds").insert(payload);
  if (error) throw error;
  return payload.id as string;
}

export async function updateWeld(id: string, patch: Partial<WeldDetailRow>) {
  const mapped = mapPatchToProjectWelds(patch);
  const { error } = await supabase.from("project_welds").update(mapped).eq("id", id);
  if (error) throw error;
}

export async function bulkUpdate(ids: string[], patch: Partial<WeldDetailRow>) {
  if (!ids.length) return;
  const mapped = mapPatchToProjectWelds(patch);
  const { error } = await supabase.from("project_welds").update(mapped).in("id", ids);
  if (error) throw error;
}

export async function deleteWelds(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from("project_welds").delete().in("id", ids);
  if (error) throw error;
}

export async function listNdtReports(): Promise<NdtReportRow[]> {
  const { data, error } = await supabase
    .from("ndt_reports")
    .select(
      `
      id,
      report_date,
      file:file_id (
        label
      ),
      method:method_id (
        code
      )
    `
    )
    .order("report_date", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    method: row.method?.code ?? null,
    report_no: row.file?.label ? String(row.file.label).replace(/\.pdf$/i, "") : null,
    date: row.report_date ?? null,
    file_url: null,
    notes: null,
  })) as NdtReportRow[];
}
