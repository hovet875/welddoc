import { SimpleGrid } from "@mantine/core";
import type { FilterOption, WpsFilters } from "@react/features/wps/lib/wpsView";
import { AppPanel } from "@react/ui/AppPanel";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";

type WpsFiltersPanelProps = {
  filters: WpsFilters;
  methodOptions: FilterOption[];
  materialOptions: FilterOption[];
  jointTypeOptions: FilterOption[];
  onChange: (next: WpsFilters) => void;
};

export function WpsFiltersPanel({
  filters,
  methodOptions,
  materialOptions,
  jointTypeOptions,
  onChange,
}: WpsFiltersPanelProps) {
  const setFilter = <K extends keyof WpsFilters>(field: K, value: WpsFilters[K]) => {
    onChange({ ...filters, [field]: value });
  };

  return (
    <AppPanel title="Filtre" meta="Filtrer på metode, materiale, fuge og søk">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
        <AppSelect
          label="Metode"
          placeholder="Alle metoder"
          data={methodOptions}
          value={filters.method}
          clearable
          searchable={methodOptions.length > 10}
          nothingFoundMessage="Ingen treff"
          onChange={(value) => setFilter("method", value)}
        />

        <AppSelect
          label="Materiale"
          placeholder="Alle materialer"
          data={materialOptions}
          value={filters.material}
          clearable
          searchable={materialOptions.length > 10}
          nothingFoundMessage="Ingen treff"
          onChange={(value) => setFilter("material", value)}
        />

        <AppSelect
          label="Fuge"
          placeholder="Alle fugetyper"
          data={jointTypeOptions}
          value={filters.jointType}
          clearable
          searchable={jointTypeOptions.length > 10}
          nothingFoundMessage="Ingen treff"
          onChange={(value) => setFilter("jointType", value)}
        />

        <AppTextInput
          label="Søk"
          placeholder="WPS/WPQR, standard, materiale, metode..."
          value={filters.query}
          onChange={(value) => setFilter("query", value)}
        />
      </SimpleGrid>
    </AppPanel>
  );
}
