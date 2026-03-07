import type { SystemUsageStorageStat, SystemUsageTableStat } from "@/repo/systemUsageRepo";

const COUNT_FORMATTER = new Intl.NumberFormat("nb-NO");
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;
const DONUT_COLORS = [
  "blue.6",
  "cyan.6",
  "teal.6",
  "green.6",
  "lime.6",
  "yellow.6",
  "orange.6",
  "red.6",
  "pink.6",
  "grape.6",
  "violet.6",
  "indigo.6",
] as const;

const TABLE_LABELS: Record<string, string> = {
  files: "Filer",
  material_certificates: "Materialsertifikater",
  ndt_certificates: "NDT-sertifikater",
  ndt_report_welders: "NDT rapport - sveisere",
  ndt_reports: "NDT-rapporter",
  profiles: "Brukerprofiler",
  project_drawings: "Prosjekttegninger",
  project_weld_logs: "Weld-logg",
  project_welds: "Prosjektsveiser",
  projects: "Prosjekter",
  welder_certificates: "Sveisesertifikater",
  wpqr: "WPQR",
  wps: "WPS",
};

export type UsageDonutSegment = {
  name: string;
  value: number;
  color: string;
  valueLabel: string;
  meta: string;
};

export function formatCount(value: number) {
  return COUNT_FORMATTER.format(Math.max(0, Math.round(value)));
}

export function formatBytes(value: number) {
  const safe = Math.max(0, value);
  if (safe === 0) return "0 B";

  let amount = safe;
  let unitIdx = 0;

  while (amount >= 1024 && unitIdx < BYTE_UNITS.length - 1) {
    amount /= 1024;
    unitIdx += 1;
  }

  const digits = amount >= 100 || unitIdx === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${BYTE_UNITS[unitIdx]}`;
}

export function formatGeneratedAt(iso: string | null) {
  if (!iso) return "Ukjent";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Ukjent";
  return date.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function prettifyTableName(tableName: string) {
  const fromMap = TABLE_LABELS[tableName];
  if (fromMap) return fromMap;

  return tableName
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function collapseSegments<T>(
  rows: T[],
  maxSegments: number,
  mergeOthers: (rows: T[]) => T
) {
  if (rows.length <= maxSegments) return rows;
  const head = rows.slice(0, maxSegments - 1);
  const tail = rows.slice(maxSegments - 1);
  return [...head, mergeOthers(tail)];
}

export function buildStorageUsageSegments(rows: SystemUsageStorageStat[], maxSegments = 6): UsageDonutSegment[] {
  const sorted = rows.filter((row) => row.totalBytes > 0).sort((a, b) => b.totalBytes - a.totalBytes);
  const collapsed = collapseSegments(
    sorted,
    maxSegments,
    (rest) => ({
      key: "Andre",
      fileCount: rest.reduce((acc, row) => acc + row.fileCount, 0),
      totalBytes: rest.reduce((acc, row) => acc + row.totalBytes, 0),
    })
  );

  return collapsed.map((row, index) => ({
    name: row.key,
    value: row.totalBytes,
    color: DONUT_COLORS[index % DONUT_COLORS.length],
    valueLabel: formatBytes(row.totalBytes),
    meta: `${formatCount(row.fileCount)} filer`,
  }));
}

export function buildTableUsageSegments(rows: SystemUsageTableStat[], maxSegments = 8): {
  segments: UsageDonutSegment[];
  modeLabel: "bytes" | "rader";
} {
  const sorted = rows.slice().sort((a, b) => b.totalBytes - a.totalBytes);
  const totalBytes = sorted.reduce((acc, row) => acc + row.totalBytes, 0);
  const useBytes = totalBytes > 0;

  const valued = sorted
    .map((row) => ({
      ...row,
      chartValue: useBytes ? row.totalBytes : row.rowEstimate,
    }))
    .filter((row) => row.chartValue > 0);

  const collapsed = collapseSegments(
    valued,
    maxSegments,
    (rest) => ({
      tableName: "andre_tabeller",
      rowEstimate: rest.reduce((acc, row) => acc + row.rowEstimate, 0),
      totalBytes: rest.reduce((acc, row) => acc + row.totalBytes, 0),
      chartValue: rest.reduce((acc, row) => acc + row.chartValue, 0),
    })
  );

  return {
    modeLabel: useBytes ? "bytes" : "rader",
    segments: collapsed.map((row, index) => ({
      name: row.tableName === "andre_tabeller" ? "Andre tabeller" : prettifyTableName(row.tableName),
      value: row.chartValue,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      valueLabel: useBytes ? formatBytes(row.totalBytes) : formatCount(row.rowEstimate),
      meta: `${formatCount(row.rowEstimate)} est. rader`,
    })),
  };
}
