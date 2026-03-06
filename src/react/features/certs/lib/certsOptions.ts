import type { MaterialRow } from "@/repo/materialRepo";
import type { NdtMethodRow } from "@/repo/ndtReportRepo";
import type { NdtInspectorRow, NdtSupplierRow } from "@/repo/ndtSupplierRepo";
import type { NdtCertRow, ProfileWelderRow, WelderCertRow } from "@/repo/certRepo";
import type { StandardRow } from "@/repo/standardRepo";
import type { WeldJointTypeRow } from "@/repo/weldJointTypeRepo";
import { buildWeldingProcessOptions, materialLabel, trimOrEmpty, type SelectOption } from "./certsView";

export function withCurrentOption(options: SelectOption[], value: string, label?: string) {
  if (!value || options.some((item) => item.value === value)) return options;
  return [...options, { value, label: label ?? `${value} (ukjent)` }];
}

export function buildStandardsByLabel(standards: StandardRow[]) {
  const byLabel = new Map<string, number | null>();
  for (const row of standards) {
    const previous = byLabel.get(row.label);
    if (previous == null || (row.revision ?? -1) > previous) {
      byLabel.set(row.label, row.revision);
    }
  }

  const out = new Map<string, string>();
  for (const [label, revision] of byLabel.entries()) {
    out.set(label, revision == null ? label : `${label}:${revision}`);
  }
  return out;
}

export function buildWelderFilterOptions(welders: ProfileWelderRow[]) {
  return welders
    .map((row) => {
      const no = trimOrEmpty(row.welder_no ?? "");
      const paddedNo = no ? no.padStart(3, "0") : "-";
      const name = trimOrEmpty(row.display_name ?? "Uten navn");
      return { value: row.id, label: `${paddedNo} - ${name}` };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}

export function buildMaterialFilterOptions(welderCerts: WelderCertRow[]) {
  const unique = new Set<string>();
  for (const row of welderCerts) {
    const label = materialLabel(row);
    if (label) unique.add(label);
  }

  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
    .map((value) => ({ value, label: value }));
}

export function buildJointTypeFilterOptions(jointTypes: WeldJointTypeRow[], welderCerts: WelderCertRow[]) {
  const unique = new Set<string>();

  for (const row of welderCerts) {
    const fromCert = String(row.coverage_joint_type ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    for (const value of fromCert) unique.add(value);
  }

  for (const row of jointTypes) {
    const value = trimOrEmpty(row.label);
    if (value) unique.add(value);
  }

  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
    .map((value) => ({ value, label: value }));
}

export function buildNdtCompanyFilterOptions(ndtSuppliers: NdtSupplierRow[], ndtCerts: NdtCertRow[]) {
  const unique = new Set<string>();

  for (const row of ndtSuppliers) {
    const value = trimOrEmpty(row.name);
    if (value) unique.add(value);
  }

  for (const row of ndtCerts) {
    const value = trimOrEmpty(row.company);
    if (value) unique.add(value);
  }

  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
    .map((value) => ({ value, label: value }));
}

export function buildNdtMethodFilterOptions(ndtMethods: NdtMethodRow[], ndtCerts: NdtCertRow[]) {
  const unique = new Set<string>();

  for (const row of ndtMethods) {
    const value = trimOrEmpty(row.label);
    if (value) unique.add(value);
  }

  for (const row of ndtCerts) {
    const value = trimOrEmpty(row.ndt_method);
    if (value) unique.add(value);
  }

  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
    .map((value) => ({ value, label: value }));
}

export function createInspectorOptionsByCompany(
  suppliers: Array<{ id: string; name: string }>,
  inspectors: Array<Pick<NdtInspectorRow, "supplier_id" | "name">>,
  certs: Array<{ company: string; personnel_name: string }>
) {
  const supplierNameById = new Map<string, string>();
  const namesByCompany = new Map<string, Set<string>>();

  const ensureCompanySet = (companyName: string) => {
    const company = trimOrEmpty(companyName);
    if (!company) return null;
    const current = namesByCompany.get(company);
    if (current) return current;
    const created = new Set<string>();
    namesByCompany.set(company, created);
    return created;
  };

  for (const supplier of suppliers) {
    const company = trimOrEmpty(supplier.name);
    if (!company) continue;
    supplierNameById.set(supplier.id, company);
    ensureCompanySet(company);
  }

  for (const inspector of inspectors) {
    const company = supplierNameById.get(inspector.supplier_id);
    if (!company) continue;
    const name = trimOrEmpty(inspector.name);
    if (!name) continue;
    ensureCompanySet(company)?.add(name);
  }

  for (const cert of certs) {
    const company = trimOrEmpty(cert.company);
    const inspectorName = trimOrEmpty(cert.personnel_name);
    if (!company || !inspectorName) continue;
    ensureCompanySet(company)?.add(inspectorName);
  }

  const out: Record<string, SelectOption[]> = {};
  for (const [company, names] of namesByCompany.entries()) {
    out[company] = Array.from(names)
      .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
      .map((value) => ({ value, label: value }));
  }

  return out;
}

export function buildWelderModalOptions(args: {
  selectedWelderRow: WelderCertRow | null;
  welderFilterOptions: SelectOption[];
  standardsByLabel: Map<string, string>;
  weldingProcesses: Array<{ code: string | null; label: string }>;
  welderCerts: WelderCertRow[];
  materials: MaterialRow[];
  jointTypes: WeldJointTypeRow[];
}) {
  const { selectedWelderRow, welderFilterOptions, standardsByLabel, weldingProcesses, welderCerts, materials, jointTypes } = args;

  const standardOptionsBase = Array.from(standardsByLabel.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));

  const processOptionsBase = buildWeldingProcessOptions(weldingProcesses, welderCerts);
  const materialOptionsBase = materials.map((row) => ({
    value: row.id,
    label: `${row.name} (${row.material_code}) - ${row.material_group}`,
  }));
  const jointTypeOptionsBase = jointTypes
    .map((row) => trimOrEmpty(row.label))
    .filter(Boolean)
    .map((value) => ({ value, label: value }));

  const welderOptions = selectedWelderRow
    ? withCurrentOption(
        welderFilterOptions,
        selectedWelderRow.profile_id,
        selectedWelderRow.profile
          ? `${trimOrEmpty(selectedWelderRow.profile.welder_no ?? "").padStart(3, "0")} - ${trimOrEmpty(
              selectedWelderRow.profile.display_name ?? "Uten navn"
            )}`
          : `${selectedWelderRow.profile_id} (ukjent)`
      )
    : welderFilterOptions;

  const standardOptions = selectedWelderRow
    ? withCurrentOption(standardOptionsBase, selectedWelderRow.standard, selectedWelderRow.standard)
    : standardOptionsBase;

  const processOptions = selectedWelderRow?.welding_process_code
    ? withCurrentOption(processOptionsBase, selectedWelderRow.welding_process_code, selectedWelderRow.welding_process_code)
    : processOptionsBase;

  const materialOptions = selectedWelderRow?.base_material_id
    ? withCurrentOption(
        materialOptionsBase,
        selectedWelderRow.base_material_id,
        selectedWelderRow.base_material ? materialLabel(selectedWelderRow) : `${selectedWelderRow.base_material_id} (ukjent)`
      )
    : materialOptionsBase;

  let jointTypeOptions = jointTypeOptionsBase;
  const selectedJointTypes = String(selectedWelderRow?.coverage_joint_type ?? "")
    .split(",")
    .map((part) => trimOrEmpty(part))
    .filter(Boolean);
  for (const value of selectedJointTypes) {
    jointTypeOptions = withCurrentOption(jointTypeOptions, value, value);
  }

  return { welderOptions, standardOptions, processOptions, materialOptions, jointTypeOptions };
}

export function buildNdtModalOptions(args: {
  selectedNdtRow: NdtCertRow | null;
  companyOptionsBase: SelectOption[];
  methodOptionsBase: SelectOption[];
  inspectorOptionsByCompanyBase: Record<string, SelectOption[]>;
}) {
  const { selectedNdtRow, companyOptionsBase, methodOptionsBase, inspectorOptionsByCompanyBase } = args;

  const companyOptions = selectedNdtRow
    ? withCurrentOption(companyOptionsBase, selectedNdtRow.company, selectedNdtRow.company)
    : companyOptionsBase;
  const methodOptions = selectedNdtRow
    ? withCurrentOption(methodOptionsBase, selectedNdtRow.ndt_method, selectedNdtRow.ndt_method)
    : methodOptionsBase;

  const inspectorOptionsByCompany = { ...inspectorOptionsByCompanyBase };
  if (selectedNdtRow) {
    const company = trimOrEmpty(selectedNdtRow.company);
    const inspectorName = trimOrEmpty(selectedNdtRow.personnel_name);
    if (company && inspectorName) {
      inspectorOptionsByCompany[company] = withCurrentOption(
        inspectorOptionsByCompany[company] ?? [],
        inspectorName,
        inspectorName
      );
    }
  }

  return { companyOptions, methodOptions, inspectorOptionsByCompany };
}
