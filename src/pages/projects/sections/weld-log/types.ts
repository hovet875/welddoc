export type WeldListRow = {
  id: string;
  sveis_id: string | number | null;
  fuge: string | null;
  komponent_a: string | null;
  komponent_b: string | null;
  sveiser_id: string | null;
  wps: string | null;
  dato: string | null;
  tilsett: string | null;
  vt_report_id: string | null;
  pt_report_id: string | null;
  vol_report_id: string | null;
  status: string | null;
  kontrollert_av: string | null;
  godkjent: boolean | null;
  updated_at: string | null;
  sveiser?: { id: string; display_name: string | null; welder_no: string | null } | null;
};

export type WeldDetailRow = WeldListRow & {
  merknader?: string | null;
  vt_comment?: string | null;
  pt_comment?: string | null;
  vol_comment?: string | null;
  vt_date?: string | null;
  pt_date?: string | null;
  vol_date?: string | null;
};

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
  status: "til-kontroll" | "godkjent" | "avvist" | "alle";
  search: string;
};

export type BulkMethod = "vt" | "pt" | "vol";

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
