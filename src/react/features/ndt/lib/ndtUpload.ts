import type { FileInboxRow } from "@/repo/fileInboxRepo";
import type { NdtMethodRow, NdtReportRow } from "@/repo/ndtReportRepo";
import type { NdtInspectorRow } from "@/repo/ndtSupplierRepo";
import { validatePdfFile } from "@/utils/format";
import { createUuid } from "@/utils/id";
import { buildNdtReportPayload } from "./ndtForm";

export type NdtUploadEntrySource =
  | { kind: "local"; file: File }
  | { kind: "inbox"; inboxId: string; fileId: string; fileName: string };

export type NdtUploadEntryDraft = {
  id: string;
  source: NdtUploadEntrySource;
  sourceName: string;
  title: string;
  customer: string;
  reportDate: string;
  methodId: string;
  supplierId: string;
  inspectorId: string;
  welderIds: string[];
  welderStats: Record<string, { weldCount: string; defectCount: string }>;
};

export type NdtUploadPayload = {
  file: File | null;
  file_id: string | null;
  inbox_id: string | null;
  source_name: string;
  method_id: string;
  ndt_supplier_id: string | null;
  ndt_inspector_id: string | null;
  weld_count: number | null;
  defect_count: number | null;
  title: string;
  customer: string;
  report_date: string;
  welder_stats: Array<{ welder_id: string; weld_count: number | null; defect_count: number | null }>;
};

function defaultIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toStringOrEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function stripPdfExt(value: string | null | undefined) {
  return String(value ?? "").replace(/\.pdf$/i, "").trim();
}

export function inferSourceNameFromFileName(fileName: string) {
  const base = stripPdfExt(fileName);
  if (!base) return "";
  const compact = base.replace(/_/g, "-").replace(/\s+/g, "-");
  const match = compact.match(/\b([A-Za-z]{2,4})-?(\d{2,4})-?(\d{1,6})(?:-?rev\.?\d+)?\b/i);
  if (!match) return base;
  return `${match[1].toUpperCase()}-${match[2]}-${match[3]}`;
}

export function normalizeSourceName(value: string | null | undefined) {
  return stripPdfExt(value).replace(/\s+/g, " ").trim();
}

function canonicalReportNo(value: string | null | undefined) {
  return normalizeSourceName(value)
    .toLowerCase()
    .replace(/[_\s.]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function looksWeakSourceName(value: string) {
  const next = normalizeSourceName(value).toLowerCase();
  if (!next) return true;
  if (!/\d/.test(next)) return true;
  if (next.length < 5) return true;
  if (/^(ndt|rapport|report|dokument|document)([-_\s].*)?$/i.test(next)) return true;
  return false;
}

export function findPotentialDuplicateReport(reports: NdtReportRow[], sourceName: string) {
  const wanted = canonicalReportNo(sourceName);
  if (!wanted) return null;

  return (
    reports.find((row) => {
      const existing = canonicalReportNo(row.file?.label || "");
      return existing === wanted;
    }) ?? null
  );
}

function inferFileNameFromPath(pathValue: string) {
  const normalized = pathValue.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || pathValue;
}

export function createLocalUploadEntry(file: File): NdtUploadEntryDraft {
  return {
    id: createUuid(),
    source: { kind: "local", file },
    sourceName: inferSourceNameFromFileName(file.name),
    title: "",
    customer: "",
    reportDate: defaultIsoDate(),
    methodId: "",
    supplierId: "",
    inspectorId: "",
    welderIds: [],
    welderStats: {},
  };
}

export function mergeInboxEntries(entries: NdtUploadEntryDraft[], rows: FileInboxRow[]) {
  const existingInbox = new Map<string, NdtUploadEntryDraft>();
  for (const entry of entries) {
    if (entry.source.kind !== "inbox") continue;
    existingInbox.set(entry.source.inboxId, entry);
  }

  const localEntries = entries.filter((entry) => entry.source.kind === "local");
  const nextInboxEntries: NdtUploadEntryDraft[] = rows.map((row) => {
    const current = existingInbox.get(row.id);
    const meta =
      row.suggested_meta && typeof row.suggested_meta === "object" && !Array.isArray(row.suggested_meta)
        ? (row.suggested_meta as Record<string, unknown>)
        : {};

    const fileName = row.file?.label || inferFileNameFromPath(row.source_path);

    return {
      id: current?.id ?? `inbox:${row.id}`,
      source: {
        kind: "inbox",
        inboxId: row.id,
        fileId: row.file_id,
        fileName,
      },
      sourceName: current?.sourceName ?? inferSourceNameFromFileName(fileName),
      title: current?.title ?? toStringOrEmpty(meta.title),
      customer: current?.customer ?? toStringOrEmpty(meta.customer),
      reportDate: (current?.reportDate ?? toStringOrEmpty(meta.report_date)) || defaultIsoDate(),
      methodId: current?.methodId ?? toStringOrEmpty(meta.method_id),
      supplierId: current?.supplierId ?? toStringOrEmpty(meta.ndt_supplier_id),
      inspectorId: current?.inspectorId ?? toStringOrEmpty(meta.ndt_inspector_id),
      welderIds: current?.welderIds ?? [],
      welderStats: current?.welderStats ?? {},
    };
  });

  return [...localEntries, ...nextInboxEntries];
}

export function buildNdtUploadPayload(
  entry: NdtUploadEntryDraft,
  methods: NdtMethodRow[],
  inspectors: NdtInspectorRow[]
): NdtUploadPayload {
  const sourceName = normalizeSourceName(entry.sourceName);

  if (!sourceName) throw new Error("Oppgi rapportnr.");
  if (looksWeakSourceName(sourceName)) {
    throw new Error("Rapportnr ser ugyldig ut. Oppgi korrekt rapportnr (f.eks. MT-25-1754).");
  }

  const reportPayload = buildNdtReportPayload(
    {
      title: entry.title,
      customer: entry.customer,
      reportDate: entry.reportDate,
      methodId: entry.methodId,
      supplierId: entry.supplierId,
      inspectorId: entry.inspectorId,
      welderIds: entry.welderIds,
      welderStats: entry.welderStats,
    },
    methods,
    inspectors,
    {
      rtWelderRequiredMessage: "Velg minst en sveiser for RT.",
    }
  );

  const payload: NdtUploadPayload = {
    file: entry.source.kind === "local" ? entry.source.file : null,
    file_id: entry.source.kind === "inbox" ? entry.source.fileId : null,
    inbox_id: entry.source.kind === "inbox" ? entry.source.inboxId : null,
    source_name: sourceName,
    ...reportPayload,
  };

  if (payload.file) {
    const validationError = validatePdfFile(payload.file, 25);
    if (validationError) throw new Error(validationError);
  }

  return payload;
}
