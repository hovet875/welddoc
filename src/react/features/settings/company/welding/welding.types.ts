import type { MaterialRow } from "../../../../../repo/materialRepo";
import type { NdtMethodRow } from "../../../../../repo/ndtReportRepo";
import type { StandardRow } from "../../../../../repo/standardRepo";
import type { WeldingProcessRow } from "../../../../../repo/weldingProcessRepo";
import type { WeldJointTypeRow } from "../../../../../repo/weldJointTypeRepo";

export type WeldingListState<T> = {
  loading: boolean;
  error: string | null;
  rows: T[];
};

export type WeldingDataState = {
  materials: WeldingListState<MaterialRow>;
  standards: WeldingListState<StandardRow>;
  ndtMethods: WeldingListState<NdtMethodRow>;
  processes: WeldingListState<WeldingProcessRow>;
  jointTypes: WeldingListState<WeldJointTypeRow>;
};
