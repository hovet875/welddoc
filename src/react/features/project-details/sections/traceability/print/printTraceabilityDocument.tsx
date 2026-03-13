import { printDocumentElement } from "@react/ui/printDocumentElement";
import type { ProjectTraceabilityRow, TraceabilityTypeRow } from "@/repo/traceabilityRepo";
import type { MaterialTraceabilityDocumentData } from "@/documents/material-traceability/materialTraceabilityDocument.types";
import type { MaterialTraceabilityDocumentColumnKey } from "@/documents/material-traceability/MaterialTraceabilityDocument";
import { MaterialTraceabilityDocumentPreview } from "../preview/MaterialTraceabilityDocumentPreview";
import { mapTraceabilityToDocument } from "../preview/mapTraceabilityToDocument";
import { sortedTraceabilityRows, statusForTraceabilityRow } from "../lib/traceabilityUtils";
import type { TraceabilityPrintOptions } from "../types";

type TraceabilityProject = {
  project_no: number;
  name: string;
};

type PrintTraceabilityDocumentArgs = {
  rows: ProjectTraceabilityRow[];
  types: TraceabilityTypeRow[];
  project: TraceabilityProject;
  options?: TraceabilityPrintOptions;
};

function filterRowsByPrintStatus(rows: ProjectTraceabilityRow[], statusFilter: TraceabilityPrintOptions["statusFilter"]) {
  return sortedTraceabilityRows(rows).filter((row) => {
    if (statusFilter === "all") return true;

    const status = statusForTraceabilityRow(row).label.toLowerCase();
    if (statusFilter === "ready") return status === "klar";
    if (statusFilter === "manual") return status === "manuell";
    if (statusFilter === "missing") return status === "mangel";
    return true;
  });
}

function buildDocumentData(args: PrintTraceabilityDocumentArgs): MaterialTraceabilityDocumentData {
  return mapTraceabilityToDocument({
    project: args.project,
    rows: filterRowsByPrintStatus(args.rows, args.options?.statusFilter ?? "all"),
    types: args.types,
  });
}

export async function printTraceabilityDocument(args: PrintTraceabilityDocumentArgs) {
  const documentData = buildDocumentData(args);
  const columnKeys = (args.options?.columns?.length
    ? args.options.columns
    : ["code", "dimensionType", "materialType", "heat"]) as MaterialTraceabilityDocumentColumnKey[];

  await printDocumentElement({
    title: `Materialsporbarhet - ${args.project.project_no}`,
    element: (
      <MaterialTraceabilityDocumentPreview
        data={documentData}
        columnKeys={columnKeys}
        showMeta={args.options?.includeProjectMeta ?? true}
      />
    ),
  });
}
