import type { CustomerRow } from "@/repo/customerRepo";
import type { ProjectRow } from "@/repo/projectRepo";

export type ProjectsModalMode = "new" | "edit";

export type ProjectStatusFilter = "" | "active" | "inactive";

export type ProjectsFilters = {
  status: ProjectStatusFilter;
  customer: string;
  text: string;
};

export type ProjectFormValues = {
  projectNo: string;
  workOrder: string;
  customer: string;
  name: string;
  isActive: boolean;
};

export type { ProjectRow, CustomerRow };
