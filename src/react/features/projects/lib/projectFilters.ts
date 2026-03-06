import type { ProjectRow, ProjectsFilters } from "../projects.types";

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function filterAndSortProjects(rows: ProjectRow[], filters: ProjectsFilters, isAdmin: boolean): ProjectRow[] {
  const status = filters.status;
  const customer = normalize(filters.customer);
  const text = normalize(filters.text);

  const filtered = rows.filter((row) => {
    if (!isAdmin && !row.is_active) return false;
    if (status === "active" && !row.is_active) return false;
    if (status === "inactive" && row.is_active) return false;

    if (customer) {
      if (normalize(row.customer) !== customer) return false;
    }

    if (text) {
      const haystack = normalize(`${row.project_no} ${row.work_order} ${row.customer} ${row.name}`);
      if (!haystack.includes(text)) return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    const aTime = Date.parse(a.created_at) || 0;
    const bTime = Date.parse(b.created_at) || 0;
    return bTime - aTime;
  });
}

export function buildCustomerFilterOptions(customers: { name: string }[], selected: string) {
  const names = Array.from(new Set(customers.map((customer) => customer.name).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

  const options = names.map((name) => ({ value: name, label: name }));

  if (selected && !names.includes(selected)) {
    options.push({ value: selected, label: selected });
  }

  return options;
}
