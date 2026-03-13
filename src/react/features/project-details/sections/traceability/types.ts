import type { MaterialCertificateRow } from "@/repo/materialCertificateRepo";
import type { MaterialRow } from "@/repo/materialRepo";
import type {
  ProjectTraceabilityRow,
  TraceabilityOptionRow,
  TraceabilityProfileRow,
  TraceabilityTypeRow,
} from "@/repo/traceabilityRepo";

export type TraceabilityOptionsByGroup = {
  dn: TraceabilityOptionRow[];
  od: TraceabilityOptionRow[];
  sch: TraceabilityOptionRow[];
  pn: TraceabilityOptionRow[];
  filler: TraceabilityOptionRow[];
  fillerManufacturer: TraceabilityOptionRow[];
  fillerDiameter: TraceabilityOptionRow[];
};

export type TraceabilityModalValues = {
  type_code: string;
  profile_id: string;
  dn: string;
  dn2: string;
  od: string;
  od2: string;
  sch: string;
  pressure_class: string;
  thickness: string;
  filler_manufacturer: string;
  filler_type: string;
  filler_diameter: string;
  description: string;
  custom_dimension: string;
  material_id: string;
  material_certificate_id: string;
  heat_number: string;
};

export type TraceabilitySavePayload = {
  type_code: string;
  profile_id: string | null;
  dn: string | null;
  dn2: string | null;
  od: string | null;
  od2: string | null;
  sch: string | null;
  pressure_class: string | null;
  thickness: string | null;
  filler_manufacturer: string | null;
  filler_type: string | null;
  filler_diameter: string | null;
  description: string | null;
  custom_dimension: string | null;
  material_id: string | null;
  material_certificate_id: string | null;
  heat_number: string | null;
};

export type TraceabilityPrintStatusFilter = "all" | "ready" | "manual" | "missing";

export type TraceabilityPrintColumnKey = "code" | "dimensionType" | "materialType" | "heat";

export type TraceabilityPrintOptions = {
  includeProjectMeta: boolean;
  statusFilter: TraceabilityPrintStatusFilter;
  columns: TraceabilityPrintColumnKey[];
};

export type FilteredCertificatesResult = {
  list: MaterialCertificateRow[];
  reason: string;
};

export type TraceabilityEditModalProps = {
  opened: boolean;
  row: ProjectTraceabilityRow | null;
  saving: boolean;
  isAdmin: boolean;
  projectId: string;
  types: TraceabilityTypeRow[];
  profiles: TraceabilityProfileRow[];
  options: TraceabilityOptionsByGroup;
  materials: MaterialRow[];
  onClose: () => void;
  onSubmit: (payload: TraceabilitySavePayload) => Promise<void>;
};
