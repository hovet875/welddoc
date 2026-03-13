import type { MaterialTraceabilityDocumentData } from "@/documents/material-traceability/materialTraceabilityDocument.types";
import type { ProjectTraceabilityRow, TraceabilityTypeRow } from "@/repo/traceabilityRepo";
import { isFillerTraceabilityRow, renderDimension, renderHeatLabel, sortedTraceabilityRows } from "../lib/traceabilityUtils";

const DASH = "-";

function normalizeDocumentReference(value: string | null | undefined) {
  const label = String(value ?? "").trim();
  if (!label) return "";
  return label.replace(/\.pdf$/i, "").trim();
}

function certificateReferenceForRow(row: ProjectTraceabilityRow) {
  const fileLabel = normalizeDocumentReference(row.cert?.file?.label);
  if (fileLabel) return fileLabel;

  const certType = String(row.cert?.cert_type ?? "").trim();
  const supplier = String(row.cert?.supplier ?? "").trim();
  const combined = [certType, supplier].filter(Boolean).join(" - ");
  return combined || DASH;
}

function formatGeneratedAt() {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

type MapTraceabilityToDocumentArgs = {
  project: { project_no: number; name: string };
  rows: ProjectTraceabilityRow[];
  types: TraceabilityTypeRow[];
};

export function mapTraceabilityToDocument(args: MapTraceabilityToDocumentArgs): MaterialTraceabilityDocumentData {
  const rows = sortedTraceabilityRows(args.rows).map((row) => {
    const fillerLabel = [row.filler_manufacturer, row.filler_type, row.filler_diameter ? `${row.filler_diameter} mm` : ""]
      .filter(Boolean)
      .join(" ");
    const typeLabel = isFillerTraceabilityRow(row) ? fillerLabel || DASH : row.material?.name || DASH;

    return {
      code: `${row.type_code}${row.code_index ?? ""}`,
      dimensionType: renderDimension(row),
      materialType: typeLabel,
      heat: renderHeatLabel(row),
      certificateReference: certificateReferenceForRow(row),
    };
  });

  const projectNo = String(args.project.project_no ?? "").trim();

  return {
    projectLabel: projectNo || args.project.name || DASH,
    projectName: args.project.name || "",
    generatedAt: formatGeneratedAt(),
    rowCount: rows.length,
    rows,
  };
}