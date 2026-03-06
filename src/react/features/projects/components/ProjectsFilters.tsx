import { Paper, SimpleGrid } from "@mantine/core";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import type { ProjectStatusFilter } from "../projects.types";

type ProjectsFiltersProps = {
  isAdmin: boolean;
  status: ProjectStatusFilter;
  customer: string;
  text: string;
  customerOptions: Array<{ value: string; label: string }>;
  onStatusChange: (value: ProjectStatusFilter) => void;
  onCustomerChange: (value: string) => void;
  onTextChange: (value: string) => void;
};

const STATUS_OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "active", label: "Aktive" },
  { value: "inactive", label: "Inaktive" },
] as const;

const CUSTOMER_ALL_VALUE = "__all_customers__";

export function ProjectsFilters({
  isAdmin,
  status,
  customer,
  text,
  customerOptions,
  onStatusChange,
  onCustomerChange,
  onTextChange,
}: ProjectsFiltersProps) {
  return (
    <Paper withBorder radius="xl" shadow="md" p="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: isAdmin ? 3 : 2 }} spacing="sm">
        {isAdmin ? (
          <AppSelect
            label="Status"
            value={status || "all"}
            data={STATUS_OPTIONS as unknown as Array<{ value: string; label: string }>}
            onChange={(value) => onStatusChange(value === "all" ? "" : ((value as ProjectStatusFilter) || ""))}
            allowDeselect={false}
          />
        ) : null}

        <AppSelect
          label="Kunde"
          value={customer || CUSTOMER_ALL_VALUE}
          data={[{ value: CUSTOMER_ALL_VALUE, label: "Alle kunder" }, ...customerOptions]}
          onChange={(value) => onCustomerChange(value === CUSTOMER_ALL_VALUE ? "" : value)}
          allowDeselect={false}
        />

        <AppTextInput
          label="Søk"
          value={text}
          onChange={onTextChange}
          placeholder="Prosjektnr, navn, kunde eller AO…"
        />
      </SimpleGrid>
    </Paper>
  );
}
