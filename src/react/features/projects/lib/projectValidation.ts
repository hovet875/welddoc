import type { ProjectFormValues } from "../projects.types";

export type ProjectPayload = {
  project_no: number;
  work_order: string;
  customer: string;
  name: string;
  is_active: boolean;
};

export function validateProjectForm(values: ProjectFormValues): ProjectPayload {
  const projectNoRaw = values.projectNo.trim();
  const projectNo = Number(projectNoRaw);
  const workOrder = values.workOrder.trim();
  const customer = values.customer.trim();
  const name = values.name.trim();

  if (!projectNoRaw || Number.isNaN(projectNo)) {
    throw new Error("Prosjektnr må være et tall.");
  }

  if (projectNo < 1 || projectNo > 10000) {
    throw new Error("Prosjektnr må være mellom 1 og 10000.");
  }

  if (!workOrder || !customer || !name) {
    throw new Error("Fyll inn prosjektnr, arbeidsordre, kunde og navn.");
  }

  if (customer === "__new__") {
    throw new Error("Velg en kunde.");
  }

  return {
    project_no: projectNo,
    work_order: workOrder,
    customer,
    name,
    is_active: values.isActive,
  };
}
