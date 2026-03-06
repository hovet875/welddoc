import type { ProfileWelderRow } from "@/repo/certRepo";
import type { NdtMethodRow, NdtReportRow } from "@/repo/ndtReportRepo";
import type { ProjectRow } from "@/repo/projectRepo";

export type SelectOption = {
  value: string;
  label: string;
};

export type NdtReportResultFilter = "" | "ok" | "fault";

export type NdtReportFilters = {
  methodId: string;
  projectNo: string;
  year: string;
  welderId: string;
  result: NdtReportResultFilter;
  query: string;
};

export const INITIAL_NDT_REPORT_FILTERS: NdtReportFilters = {
  methodId: "",
  projectNo: "",
  year: "",
  welderId: "",
  result: "",
  query: "",
};

export const NDT_RESULT_OPTIONS: SelectOption[] = [
  { value: "ok", label: "Godkjent" },
  { value: "fault", label: "Avvist" },
];

export type NdtRtYearStat = {
  year: number;
  welds: number;
  defects: number;
  rate: number;
};

type NdtRtStatsInputRow = {
  report_date: string | null;
  created_at: string;
  weld_count: number | null;
  defect_count: number | null;
  report_welders: Array<{
    welder_id: string;
    weld_count: number | null;
    defect_count: number | null;
    welder?: { id: string; display_name: string | null; welder_no: string | null } | null;
  }>;
};

export function trimOrEmpty(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function hasNdtReportFilters(filters: NdtReportFilters) {
  return Boolean(filters.methodId || filters.projectNo || filters.year || filters.welderId || filters.result || filters.query);
}

function normalize(value: string | null | undefined) {
  return trimOrEmpty(value).toLowerCase();
}

function parseDateForSort(value: string | null | undefined) {
  const cleaned = trimOrEmpty(value);
  if (!cleaned) return Number.NEGATIVE_INFINITY;

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);
    return Date.UTC(year, month - 1, day);
  }

  const parsed = Date.parse(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function reportDateSortValue(row: NdtReportRow) {
  const reportDateValue = parseDateForSort(row.report_date);
  if (reportDateValue !== Number.NEGATIVE_INFINITY) return reportDateValue;
  return parseDateForSort(row.created_at);
}

export function sortNdtReportRowsByReportDateDesc(rows: NdtReportRow[]) {
  return [...rows].sort((a, b) => {
    const byDate = reportDateSortValue(b) - reportDateSortValue(a);
    if (byDate !== 0) return byDate;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

function firstNameFromDisplayName(displayName: string | null | undefined) {
  const cleaned = trimOrEmpty(displayName).replace(/\s+/g, " ");
  if (!cleaned) return "Uten navn";
  const parts = cleaned.split(" ");
  if (parts.length <= 1) return cleaned;
  return parts.slice(0, -1).join(" ");
}

function formatWelderLabelFromRaw(welderNo: string | null | undefined, displayName: string | null | undefined) {
  const no = trimOrEmpty(welderNo);
  const paddedNo = no ? no.padStart(3, "0") : "-";
  const name = trimOrEmpty(displayName) || "Uten navn";
  return `${paddedNo} - ${name}`;
}

export function formatWelderLabel(welder: Pick<ProfileWelderRow, "welder_no" | "display_name">) {
  return formatWelderLabelFromRaw(welder.welder_no, welder.display_name);
}

export function formatReportWelderList(rows: NdtReportRow["report_welders"]) {
  const labels = rows
    .map((row) => row.welder)
    .filter(Boolean)
    .map((welder) => firstNameFromDisplayName(welder?.display_name));
  return labels.length > 0 ? labels.join(", ") : "-";
}

export function reportDateIso(row: Pick<NdtReportRow, "report_date" | "created_at">) {
  return trimOrEmpty(row.report_date) || row.created_at;
}

export function reportYear(row: Pick<NdtReportRow, "report_date" | "created_at">) {
  const parsed = new Date(reportDateIso(row));
  const year = parsed.getFullYear();
  return Number.isNaN(year) ? null : year;
}

export function isFaultReport(row: NdtReportRow) {
  return (row.defect_count ?? 0) > 0;
}

function methodLabelFromRow(row: NdtReportRow) {
  return trimOrEmpty(row.method?.label) || trimOrEmpty(row.method?.code) || trimOrEmpty(row.method_id);
}

export function buildMethodFilterOptions(methods: NdtMethodRow[], reports: NdtReportRow[] = []): SelectOption[] {
  const labelById = new Map<string, string>();

  for (const row of methods) {
    const id = trimOrEmpty(row.id);
    if (!id) continue;
    const label = trimOrEmpty(row.label) || trimOrEmpty(row.code) || id;
    labelById.set(id, label);
  }

  for (const row of reports) {
    const id = trimOrEmpty(row.method_id);
    if (!id || labelById.has(id)) continue;
    labelById.set(id, methodLabelFromRow(row) || id);
  }

  return Array.from(labelById.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}

export function buildProjectFilterOptions(projects: ProjectRow[], reports: NdtReportRow[] = []): SelectOption[] {
  const labelByProjectNo = new Map<string, string>();

  for (const row of projects) {
    const projectNo = String(row.project_no);
    const label = trimOrEmpty(row.name) ? `${projectNo} - ${row.name}` : projectNo;
    labelByProjectNo.set(projectNo, label);
  }

  for (const row of reports) {
    const projectNo = trimOrEmpty(row.title);
    if (!projectNo || labelByProjectNo.has(projectNo)) continue;
    labelByProjectNo.set(projectNo, projectNo);
  }

  return Array.from(labelByProjectNo.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.value.localeCompare(b.value, "nb", { numeric: true, sensitivity: "base" }));
}

export function buildYearFilterOptions(reports: NdtReportRow[]): SelectOption[] {
  const years = new Set<string>();

  for (const row of reports) {
    const year = reportYear(row);
    if (year == null) continue;
    years.add(String(year));
  }

  return Array.from(years)
    .sort((a, b) => Number(b) - Number(a))
    .map((value) => ({ value, label: value }));
}

export function buildYearFilterOptionsFromValues(years: string[]): SelectOption[] {
  return [...new Set(years.map((year) => String(year).trim()).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a))
    .map((value) => ({ value, label: value }));
}

export function buildWelderFilterOptions(welders: ProfileWelderRow[], reports: NdtReportRow[] = []): SelectOption[] {
  const labelById = new Map<string, string>();

  for (const welder of welders) {
    const id = trimOrEmpty(welder.id);
    if (!id) continue;
    labelById.set(id, formatWelderLabel(welder));
  }

  for (const report of reports) {
    for (const linked of report.report_welders || []) {
      const id = trimOrEmpty(linked.welder_id);
      if (!id || labelById.has(id)) continue;
      labelById.set(
        id,
        formatWelderLabelFromRaw(
          linked.welder?.welder_no ?? null,
          linked.welder?.display_name ?? linked.welder_id
        )
      );
    }
  }

  return Array.from(labelById.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}

function queryTextForRow(row: NdtReportRow) {
  const welderParts = (row.report_welders || []).flatMap((linked) => [
    linked.welder_id,
    linked.welder?.welder_no ?? "",
    linked.welder?.display_name ?? "",
  ]);
  return [
    row.file?.label ?? "",
    row.title ?? "",
    row.customer ?? "",
    row.ndt_supplier?.name ?? "",
    row.ndt_inspector?.name ?? "",
    row.method?.code ?? "",
    row.method?.label ?? "",
    formatReportWelderList(row.report_welders || []),
    ...welderParts,
  ]
    .map((part) => normalize(part))
    .join(" ");
}

export function filterNdtReportRows(rows: NdtReportRow[], filters: NdtReportFilters) {
  const query = normalize(filters.query);

  const filtered = rows.filter((row) => {
    if (filters.methodId && trimOrEmpty(row.method_id) !== filters.methodId) return false;
    if (filters.projectNo && trimOrEmpty(row.title) !== filters.projectNo) return false;
    if (filters.year) {
      const year = reportYear(row);
      if (String(year ?? "") !== filters.year) return false;
    }
    if (filters.welderId) {
      const hasWelder = (row.report_welders || []).some((welderRow) => welderRow.welder_id === filters.welderId);
      if (!hasWelder) return false;
    }
    if (filters.result === "ok" && isFaultReport(row)) return false;
    if (filters.result === "fault" && !isFaultReport(row)) return false;
    if (query && !queryTextForRow(row).includes(query)) return false;
    return true;
  });

  return sortNdtReportRowsByReportDateDesc(filtered);
}

export function getTotalPages(totalRows: number, pageSize: number) {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalRows / pageSize));
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  if (pageSize <= 0) return rows;
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function formatCount(filtered: number, total: number, hasFilters: boolean) {
  return hasFilters ? `${filtered} av ${total}` : `${total} stk`;
}

function getRtCountsForRow(
  row: Pick<NdtReportRow, "weld_count" | "defect_count"> & {
    report_welders: NdtRtStatsInputRow["report_welders"];
  },
  activeWelderId: string
) {
  const welderRows = row.report_welders || [];
  if (activeWelderId) {
    const matching = welderRows.filter((welderRow) => welderRow.welder_id === activeWelderId);
    if (matching.length === 0) return { welds: 0, defects: 0 };

    const hasPerWelderCounts = matching.some((welderRow) => welderRow.weld_count != null || welderRow.defect_count != null);
    if (hasPerWelderCounts) {
      return matching.reduce(
        (acc, welderRow) => ({
          welds: acc.welds + (welderRow.weld_count ?? 0),
          defects: acc.defects + (welderRow.defect_count ?? 0),
        }),
        { welds: 0, defects: 0 }
      );
    }

    if (welderRows.length === 1 && welderRows[0]?.welder_id === activeWelderId) {
      return { welds: row.weld_count ?? 0, defects: row.defect_count ?? 0 };
    }
    return { welds: 0, defects: 0 };
  }

  const hasPerWelderCounts = welderRows.some((welderRow) => welderRow.weld_count != null || welderRow.defect_count != null);
  if (hasPerWelderCounts) {
    return welderRows.reduce(
      (acc, welderRow) => ({
        welds: acc.welds + (welderRow.weld_count ?? 0),
        defects: acc.defects + (welderRow.defect_count ?? 0),
      }),
      { welds: 0, defects: 0 }
    );
  }

  return { welds: row.weld_count ?? 0, defects: row.defect_count ?? 0 };
}

export function computeRtYearStats(rows: NdtReportRow[], activeWelderId: string) {
  const rtRows = rows.filter((row) => trimOrEmpty(row.method?.code).toUpperCase() === "RT");

  return computeRtYearStatsFromRtRows(rtRows, activeWelderId);
}

export function computeRtYearStatsFromRtRows(rows: NdtRtStatsInputRow[], activeWelderId: string) {
  const yearTotals = new Map<number, { welds: number; defects: number }>();

  for (const row of rows) {
    const year = reportYear(row);
    if (year == null) continue;
    const counts = getRtCountsForRow(row, activeWelderId);
    const current = yearTotals.get(year) ?? { welds: 0, defects: 0 };
    yearTotals.set(year, {
      welds: current.welds + counts.welds,
      defects: current.defects + counts.defects,
    });
  }

  return Array.from(yearTotals.entries())
    .map(([year, totals]) => ({
      year,
      welds: totals.welds,
      defects: totals.defects,
      rate: totals.welds > 0 ? (totals.defects / totals.welds) * 100 : 0,
    }))
    .sort((a, b) => a.year - b.year);
}

export function rateTone(rate: number): "success" | "warning" | "danger" {
  if (rate <= 2) return "success";
  if (rate <= 4) return "warning";
  return "danger";
}
