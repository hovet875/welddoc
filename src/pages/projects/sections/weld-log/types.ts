export type WeldListRow = {
  id: string;
  sveis_id: string | number | null;
  fuge: string | null;
  komponent_a: string | null;
  komponent_a_id: string | null;
  komponent_b: string | null;
  komponent_b_id: string | null;
  sveiser_id: string | null;
  wps: string | null;
  wps_id: string | null;
  dato: string | null;
  tilsett: string | null;
  tilsett_id: string | null;
  vt_report_id: string | null;
  pt_report_id: string | null;
  vol_report_id: string | null;
  status: boolean | null;
  kontrollert_av: string | null;
  updated_at: string | null;
  sveiser?: { id: string; display_name: string | null; welder_no: string | null } | null;
};

export type WeldDetailRow = WeldListRow;

export type NdtReportRow = {
  id: string;
  method: string | null;
  report_no: string | null;
  date: string | null;
  file_url: string | null;
  notes: string | null;
};

export type ListResult<T> = {
  rows: T[];
  count: number;
};

export type ListFilters = {
  status: "false" | "true" | "all";
  search: string;
};

export type BulkMethodSlot = "vt" | "pt" | "vol";

export type NdtMethodOption = {
  code: string;
  label: string;
};

export type DrawingOption = {
  id: string;
  drawing_no: string;
  revision: string | null;
};

export type WelderOption = {
  id: string;
  welder_no: string | null;
  display_name: string | null;
};

export type EmployeeOption = {
  id: string;
  welder_no: string | null;
  display_name: string | null;
  label: string;
};

export type TraceabilitySelectOption = {
  id: string;
  trace_code: string;
  material_id: string | null;
  dn: string | null;
  heat_number: string | null;
  label: string;
};

export type WpsSelectOption = {
  id: string;
  doc_no: string;
  material_id: string | null;
  fuge: string;
  label: string;
};

export type RowWpsStatus = {
  tone: "ok" | "warn" | "danger";
  title: string;
  symbol: string;
};
