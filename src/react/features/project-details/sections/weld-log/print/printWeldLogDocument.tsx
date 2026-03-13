import type { ProfileWelderRow } from "@/repo/certRepo";
import type { ProjectWeldRow, WeldEmployeeOption } from "@/repo/weldLogRepo";
import type { WeldLogDocumentData } from "@/documents/weld-log/weldLogDocument.types";
import { printDocumentElement } from "@react/ui/printDocumentElement";
import { WeldLogDocumentPreview } from "../preview/WeldLogDocumentPreview";
import { mapWeldLogToDocument } from "../preview/mapWeldLogToDocument";
import type { WeldLogNdtReportOption, WeldLogPrintOptions, WeldLogProject } from "../types";

type PrintWeldLogDocumentArgs = {
  rows: ProjectWeldRow[];
  reports: WeldLogNdtReportOption[];
  employees: WeldEmployeeOption[];
  welders: ProfileWelderRow[];
  project: WeldLogProject;
  drawingLabel: string;
  options?: WeldLogPrintOptions;
};

function filterRowsByPrintStatus(rows: ProjectWeldRow[], statusFilter: WeldLogPrintOptions["statusFilter"]) {
  if (statusFilter === "ready") return rows.filter((row) => Boolean(row.status));
  if (statusFilter === "pending") return rows.filter((row) => !row.status);
  return rows;
}

function buildDocumentData(args: PrintWeldLogDocumentArgs): WeldLogDocumentData {
  return mapWeldLogToDocument({
    project: args.project,
    drawingLabel: args.drawingLabel,
    rows: filterRowsByPrintStatus(args.rows, args.options?.statusFilter ?? "all"),
    reports: args.reports,
    employees: args.employees,
    welders: args.welders,
  });
}

export async function printWeldLogDocument(args: PrintWeldLogDocumentArgs) {
  const documentData = buildDocumentData(args);

  await printDocumentElement({
    title: `Sveiselogg - ${args.drawingLabel}`,
    element: (
      <WeldLogDocumentPreview
        data={documentData}
        columnKeys={args.options?.columns}
        showMeta={args.options?.includeProjectMeta ?? true}
      />
    ),
  });
}
