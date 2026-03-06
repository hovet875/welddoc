import type { WeldingProcessRow } from "@/repo/weldingProcessRepo";
import type { WPQRRow, WPSRow } from "@/repo/wpsRepo";
import { fmtDate } from "@/utils/format";

export type WpsFilters = {
  method: string;
  material: string;
  jointType: string;
  query: string;
};

export type FilterOption = {
  value: string;
  label: string;
};

type ProcessRowLike = Pick<WPSRow | WPQRRow, "process" | "doc_date" | "created_at">;
type MaterialRowLike = Pick<WPSRow | WPQRRow, "material" | "materiale">;
type StandardRowLike = Pick<WPSRow | WPQRRow, "standard">;
type JointRowLike = Pick<WPSRow | WPQRRow, "fuge">;

function asTrimmedString(value: unknown) {
  return String(value ?? "").trim();
}

function normalize(value: unknown) {
  return asTrimmedString(value).toLowerCase();
}

export function extractProcessCode(raw: unknown) {
  const value = asTrimmedString(raw);
  if (!value) return "";

  const direct = value.match(/^([0-9]{2,4})(?:\s*-\s*.*)?$/);
  if (direct) return direct[1];

  const embedded = value.match(/\b([0-9]{2,4})\b/);
  if (embedded) return embedded[1];

  return value.toUpperCase();
}

function normalizeProcessLabel(code: string, label: string) {
  const cleanCode = code.trim();
  const cleanLabel = label.trim().replace(new RegExp(`^${cleanCode}\\s*-\\s*`, "i"), "").trim();
  return cleanLabel;
}

export function buildProcessDictionary(processes: WeldingProcessRow[]) {
  const map = new Map<string, string>();

  for (const row of processes) {
    let code = (row.code ?? "").trim();
    let label = (row.label ?? "").trim();

    if (!code && label) {
      const fromLabel = label.match(/^([0-9]{2,4})\s*-\s*(.+)$/);
      if (fromLabel) {
        code = fromLabel[1].trim();
        label = fromLabel[2].trim();
      } else if (/^[0-9]{2,4}$/.test(label)) {
        code = label;
        label = "";
      }
    }

    if (!code) continue;
    const cleanLabel = normalizeProcessLabel(code, label);
    map.set(code, cleanLabel ? `${code} - ${cleanLabel}` : code);
  }

  return map;
}

export function resolveProcessKey(raw: unknown, processDictionary: Map<string, string>) {
  const value = asTrimmedString(raw);
  if (!value) return "";

  if (processDictionary.has(value)) return value;

  const extracted = extractProcessCode(value);
  if (processDictionary.has(extracted)) return extracted;

  return extracted || value;
}

export function processDisplay(raw: unknown, processDictionary: Map<string, string>) {
  const key = resolveProcessKey(raw, processDictionary);
  if (!key) return "Ukjent";
  return processDictionary.get(key) ?? key;
}

export function materialDisplay(row: MaterialRowLike) {
  const material = row.material as
    | { name?: unknown; material_code?: unknown; material_group?: unknown }
    | null
    | undefined;

  if (material) {
    const name = asTrimmedString(material.name);
    const code = asTrimmedString(material.material_code);
    const group = asTrimmedString(material.material_group);
    if (name || code || group) return `${name} (${code}) - ${group}`;
  }
  return asTrimmedString(row.materiale);
}

export function standardDisplay(row: StandardRowLike) {
  const standard = row.standard as { label?: unknown; revision?: unknown } | null | undefined;
  if (!standard) return "";

  const label = asTrimmedString(standard.label);
  if (!label) return "";
  const revision = asTrimmedString(standard.revision);
  return revision ? `${label}:${revision}` : label;
}

export function rowTimestamp(row: Pick<WPSRow | WPQRRow, "doc_date" | "created_at">) {
  const docDate = asTrimmedString(row.doc_date);
  if (docDate) {
    const docDateTime = Date.parse(`${docDate}T00:00:00.000Z`);
    if (Number.isFinite(docDateTime)) return docDateTime;
    const fallbackDateTime = Date.parse(docDate);
    if (Number.isFinite(fallbackDateTime)) return fallbackDateTime;
  }

  const createdAt = Date.parse(asTrimmedString(row.created_at));
  if (Number.isFinite(createdAt)) return createdAt;
  return 0;
}

export function rowDateLabel(row: Pick<WPSRow | WPQRRow, "doc_date" | "created_at">) {
  return fmtDate(asTrimmedString(row.doc_date) || asTrimmedString(row.created_at));
}

function compareRowsByDateAndMeta(
  a: WPSRow | WPQRRow,
  b: WPSRow | WPQRRow,
  processDictionary: Map<string, string>
) {
  const dateDiff = rowTimestamp(b) - rowTimestamp(a);
  if (dateDiff !== 0) return dateDiff;

  const processA = normalize(resolveProcessKey(a.process, processDictionary));
  const processB = normalize(resolveProcessKey(b.process, processDictionary));
  if (processA !== processB) {
    return processA.localeCompare(processB, "nb", { numeric: true, sensitivity: "base" });
  }

  const jointA = normalize(a.fuge);
  const jointB = normalize(b.fuge);
  if (jointA !== jointB) return jointA.localeCompare(jointB, "nb", { sensitivity: "base" });

  return normalize(a.doc_no).localeCompare(normalize(b.doc_no), "nb", { sensitivity: "base" });
}

function filterRows<T extends WPSRow | WPQRRow>(
  rows: T[],
  filters: WpsFilters,
  processDictionary: Map<string, string>
) {
  const query = normalize(filters.query);

  return rows
    .filter((row) => {
      if (filters.method) {
        const rowMethod = resolveProcessKey(row.process, processDictionary);
        if (normalize(rowMethod) !== normalize(filters.method)) return false;
      }

      if (filters.material) {
        if (normalize(materialDisplay(row)) !== normalize(filters.material)) return false;
      }

      if (filters.jointType) {
        if (normalize(row.fuge) !== normalize(filters.jointType)) return false;
      }

      if (!query) return true;

      const searchText = [
        asTrimmedString((row as { doc_no?: unknown }).doc_no),
        processDisplay((row as { process?: unknown }).process, processDictionary),
        asTrimmedString((row as { fuge?: unknown }).fuge),
        standardDisplay(row),
        materialDisplay(row),
        "wpqr" in row ? asTrimmedString((row as WPSRow).wpqr?.doc_no) : "",
      ]
        .filter(Boolean)
        .join(" ");

      return normalize(searchText).includes(query);
    })
    .sort((a, b) => compareRowsByDateAndMeta(a, b, processDictionary));
}

export function filterWpqrRows(rows: WPQRRow[], filters: WpsFilters, processDictionary: Map<string, string>) {
  return filterRows(rows, filters, processDictionary);
}

export function filterWpsRows(rows: WPSRow[], filters: WpsFilters, processDictionary: Map<string, string>) {
  return filterRows(rows, filters, processDictionary);
}

export function buildMethodFilterOptions(
  rows: Array<WPSRow | WPQRRow>,
  processDictionary: Map<string, string>
): FilterOption[] {
  const unique = new Set<string>();

  for (const row of rows) {
    const key = resolveProcessKey(row.process, processDictionary);
    if (key) unique.add(key);
  }

  for (const key of processDictionary.keys()) {
    unique.add(key);
  }

  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b, "nb", { numeric: true, sensitivity: "base" }))
    .map((value) => ({
      value,
      label: processDisplay(value, processDictionary),
    }));
}

export function buildMaterialFilterOptions(rows: MaterialRowLike[]): FilterOption[] {
  const unique = new Set<string>();

  for (const row of rows) {
    const label = materialDisplay(row).trim();
    if (label) unique.add(label);
  }

  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
    .map((value) => ({ value, label: value }));
}

export function buildJointTypeFilterOptions(rows: JointRowLike[]): FilterOption[] {
  const unique = new Set<string>();

  for (const row of rows) {
    const label = asTrimmedString(row.fuge);
    if (label) unique.add(label);
  }

  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
    .map((value) => ({ value, label: value }));
}

export type ProcessGroup<T extends ProcessRowLike> = {
  key: string;
  label: string;
  rows: T[];
};

export function groupRowsByProcess<T extends ProcessRowLike>(
  rows: T[],
  processDictionary: Map<string, string>
): ProcessGroup<T>[] {
  const groups = new Map<string, ProcessGroup<T>>();

  for (const row of rows) {
    const processKey = resolveProcessKey(row.process, processDictionary) || "UKJENT";
    const existing = groups.get(processKey);
    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(processKey, {
      key: processKey,
      label: processDisplay(row.process || processKey, processDictionary),
      rows: [row],
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const newestA = Math.max(...a.rows.map((row) => rowTimestamp(row)));
    const newestB = Math.max(...b.rows.map((row) => rowTimestamp(row)));
    if (newestA !== newestB) return newestB - newestA;
    return a.key.localeCompare(b.key, "nb", { numeric: true, sensitivity: "base" });
  });
}
