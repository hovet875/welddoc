import type { ProfileWelderRow } from "@/repo/certRepo";
import type { CustomerRow } from "@/repo/customerRepo";
import type { NdtMethodRow } from "@/repo/ndtReportRepo";
import type { NdtInspectorRow, NdtSupplierRow } from "@/repo/ndtSupplierRepo";
import type { ProjectRow } from "@/repo/projectRepo";
import { formatWelderLabel, trimOrEmpty, type SelectOption } from "./ndtView";

export function withCurrentOption(options: SelectOption[], value: string, fallbackLabel?: string) {
  if (!value) return options;
  if (options.some((option) => option.value === value)) return options;
  return [...options, { value, label: fallbackLabel ?? value }];
}

export function buildProjectCustomerByNo(projects: ProjectRow[]) {
  const map = new Map<string, string>();
  for (const project of projects) {
    map.set(String(project.project_no), trimOrEmpty(project.customer));
  }
  return map;
}

export function buildMethodById(methods: NdtMethodRow[]) {
  const map = new Map<string, NdtMethodRow>();
  for (const method of methods) {
    map.set(method.id, method);
  }
  return map;
}

export function buildMethodOptions(methods: NdtMethodRow[]): SelectOption[] {
  return methods
    .map((method) => ({
      value: method.id,
      label: trimOrEmpty(method.label) || trimOrEmpty(method.code) || method.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}

export function buildProjectOptions(projects: ProjectRow[]): SelectOption[] {
  return projects
    .map((project) => {
      const projectNo = String(project.project_no);
      const projectLabel = trimOrEmpty(project.name) ? `${projectNo} - ${project.name}` : projectNo;
      return {
        value: projectNo,
        label: projectLabel,
      };
    })
    .sort((a, b) => a.value.localeCompare(b.value, "nb", { numeric: true, sensitivity: "base" }));
}

export function buildCustomerOptions(customers: CustomerRow[]): SelectOption[] {
  return customers
    .map((customer) => ({
      value: trimOrEmpty(customer.name),
      label: trimOrEmpty(customer.name),
    }))
    .filter((option) => option.value)
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}

export function buildSupplierOptions(suppliers: NdtSupplierRow[]): SelectOption[] {
  return suppliers
    .map((supplier) => ({
      value: supplier.id,
      label: trimOrEmpty(supplier.name) || supplier.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}

export function buildWelderOptions(welders: ProfileWelderRow[]): SelectOption[] {
  return welders
    .map((welder) => ({
      value: welder.id,
      label: formatWelderLabel(welder),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}

export function buildWelderLabelById(welderOptions: SelectOption[]) {
  const map = new Map<string, string>();
  for (const option of welderOptions) {
    map.set(option.value, option.label);
  }
  return map;
}

export function buildInspectorOptions(inspectors: NdtInspectorRow[], supplierId: string): SelectOption[] {
  if (!supplierId) return [];

  return inspectors
    .filter((inspector) => inspector.supplier_id === supplierId)
    .map((inspector) => ({
      value: inspector.id,
      label: trimOrEmpty(inspector.name) || inspector.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}
