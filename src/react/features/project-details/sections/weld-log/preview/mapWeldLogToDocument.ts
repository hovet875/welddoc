import type { ProfileWelderRow } from "@/repo/certRepo";
import type { ProjectWeldRow, WeldEmployeeOption } from "@/repo/weldLogRepo";
import { WeldLogDocument } from "@/documents/weld-log/WeldLogDocument";
import type { WeldLogDocumentData } from "@/documents/weld-log/weldLogDocument.types";
import { formatNorDate, getWelderLabel, sortRowsByWeldNo, statusLabel } from "../lib/weldLogUtils";
import type { WeldLogNdtReportOption, WeldLogProject } from "../types";

const DASH = "-";

function normalizeReportLabel(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.replace(/\.pdf$/i, "").trim();
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

function componentLabel(row: ProjectWeldRow) {
  const left = row.component_a ? `${row.component_a.type_code}${row.component_a.code_index ?? ""}` : "";
  const right = row.component_b ? `${row.component_b.type_code}${row.component_b.code_index ?? ""}` : "";
  if (left && right) return `${left} -> ${right}`;
  return left || right || DASH;
}

function fillerLabel(row: ProjectWeldRow) {
  return row.filler ? `${row.filler.type_code}${row.filler.code_index ?? ""}` : DASH;
}

function reportLookup(reports: WeldLogNdtReportOption[]) {
  return new Map(
    reports
      .map((report) => {
        const id = String(report.id ?? "").trim();
        if (!id) return null;
        return [id, String(report.report_no ?? "").trim() || id] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );
}

function employeeLookup(employees: WeldEmployeeOption[]) {
  return new Map(
    employees
      .map((employee) => {
        const id = String(employee.id ?? "").trim();
        if (!id) return null;
        return [id, employee.displayLabel || employee.label || id] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );
}

type MapWeldLogToDocumentArgs = {
  project: WeldLogProject;
  drawingLabel: string;
  rows: ProjectWeldRow[];
  reports: WeldLogNdtReportOption[];
  employees: WeldEmployeeOption[];
  welders: ProfileWelderRow[];
};

export function mapWeldLogToDocument(args: MapWeldLogToDocumentArgs): WeldLogDocumentData {
  const reportsById = reportLookup(args.reports);
  const employeesById = employeeLookup(args.employees);
  const rows = sortRowsByWeldNo(args.rows).map((row) => {
    const vtReport = reportsById.get(String(row.visual_report_id ?? "").trim()) || normalizeReportLabel(row.visual_report?.file?.label);
    const vtInspector = employeesById.get(String(row.visual_inspector ?? "").trim()) || "";
    const ptReport = reportsById.get(String(row.crack_report_id ?? "").trim()) || normalizeReportLabel(row.crack_report?.file?.label);
    const volReport = reportsById.get(String(row.volumetric_report_id ?? "").trim()) || normalizeReportLabel(row.volumetric_report?.file?.label);

    return {
      weldNumber: String(row.weld_no ?? DASH),
      jointType: String(row.joint_type ?? DASH),
      component: componentLabel(row),
      welder: getWelderLabel(row, args.welders),
      wps: String(row.wps?.doc_no ?? DASH),
      weldDate: formatNorDate(row.weld_date),
      filler: fillerLabel(row),
      vt: vtReport || (vtInspector ? `${vtInspector}` : DASH),
      pt: ptReport || DASH,
      vol: volReport || DASH,
      status: statusLabel(row.status),
    };
  });

  const projectNo = String(args.project.project_no ?? "").trim();

  return {
    projectLabel: projectNo || args.project.name || DASH,
    projectName: args.project.name || "",
    drawingLabel: args.drawingLabel || DASH,
    generatedAt: formatGeneratedAt(),
    rowCount: rows.length,
    rows,
  };
}

export { WeldLogDocument };
