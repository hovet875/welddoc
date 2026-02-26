import type { CustomerRow } from "../../../../../repo/customerRepo";
import type { JobTitleRow } from "../../../../../repo/jobTitleRepo";
import type { NdtInspectorRow, NdtSupplierRow } from "../../../../../repo/ndtSupplierRepo";
import type { SupplierRow } from "../../../../../repo/supplierRepo";

export type OrganizationListState<T> = {
  loading: boolean;
  error: string | null;
  rows: T[];
};

export type OrganizationDataState = {
  jobTitles: OrganizationListState<JobTitleRow>;
  customers: OrganizationListState<CustomerRow>;
  suppliers: OrganizationListState<SupplierRow>;
  ndtSuppliers: OrganizationListState<NdtSupplierRow>;
  ndtInspectors: OrganizationListState<NdtInspectorRow>;
};
