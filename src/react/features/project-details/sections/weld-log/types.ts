import type { ProjectWeldLogRow, ProjectWeldRow, WeldEmployeeOption, WeldNdtReportOption } from "@/repo/weldLogRepo";
import type { ProjectDrawingRow } from "@/repo/projectDrawingRepo";
import type { WelderCertLookupRow, ProfileWelderRow } from "@/repo/certRepo";
import type { ProjectTraceabilityRow } from "@/repo/traceabilityRepo";
import type { WelderCertScopeRow } from "@/repo/welderCertScopeRepo";

export type WeldLogProject = {
  id: string;
  project_no: number;
  name: string;
};

export type WeldLogStatusFilter = "all" | "ready" | "pending";

export type WeldLogBulkField = "joint_type" | "welder" | "weld_date" | "filler" | "vt" | "pt" | "vol";

export type WeldLogTraceabilityOption = {
  id: string;
  trace_code: string;
  material_id: string | null;
  dn: string | null;
  heat_number: string | null;
  label: string;
};

export type WeldLogWpsOption = {
  id: string;
  doc_no: string;
  process: string | null;
  standard_label: string | null;
  material_id: string | null;
  joint_type: string;
  label: string;
};

export type WeldLogEmployeeOption = WeldEmployeeOption;
export type WeldLogNdtReportOption = WeldNdtReportOption;

export type WeldLogDataBundle = {
  drawings: ProjectDrawingRow[];
  logs: ProjectWeldLogRow[];
  rows: ProjectWeldRow[];
  reports: WeldLogNdtReportOption[];
  employees: WeldLogEmployeeOption[];
  welders: ProfileWelderRow[];
  welderCerts: WelderCertLookupRow[];
  welderScopes: WelderCertScopeRow[];
  componentOptions: WeldLogTraceabilityOption[];
  fillerOptions: WeldLogTraceabilityOption[];
  wpsOptions: WeldLogWpsOption[];
  jointTypes: string[];
};

export type WeldLogEditorValues = {
  id: string | null;
  weld_no: string;
  joint_type: string;
  component_a_id: string;
  component_b_id: string;
  welder_id: string;
  welder_cert_id: string;
  wps_id: string;
  weld_date: string;
  filler_traceability_id: string;
  visual_report_id: string;
  visual_inspector: string;
  crack_report_id: string;
  volumetric_report_id: string;
  status: boolean;
};

export type WeldLogSectionState = {
  drawingId: string;
  logId: string;
  statusFilter: WeldLogStatusFilter;
};

export type WeldLogBulkState = {
  field: WeldLogBulkField | "";
  value: string;
  vtNoReport: boolean;
  vtInspectorId: string;
};

export type WeldLogDerived = {
  allRows: ProjectWeldRow[];
  filteredRows: ProjectWeldRow[];
};

export type WeldLogPrintStatusFilter = "all" | "ready" | "pending";

export type WeldLogPrintColumnKey =
  | "weldNumber"
  | "jointType"
  | "component"
  | "welder"
  | "wps"
  | "weldDate"
  | "filler"
  | "vt"
  | "pt"
  | "vol"
  | "status";

export type WeldLogPrintOptions = {
  includeProjectMeta: boolean;
  statusFilter: WeldLogPrintStatusFilter;
  columns: WeldLogPrintColumnKey[];
};

export const WELD_LOG_PRINT_DEFAULTS: WeldLogPrintOptions = {
  includeProjectMeta: true,
  statusFilter: "all",
  columns: ["weldNumber", "jointType", "component", "welder", "wps", "weldDate", "filler", "vt", "pt", "vol", "status"],
};

export type WeldLogTraceabilitySource = ProjectTraceabilityRow;
