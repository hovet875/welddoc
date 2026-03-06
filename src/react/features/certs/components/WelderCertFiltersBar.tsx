import { SimpleGrid } from "@mantine/core";
import { CERT_STATUS_OPTIONS, isCertStatus, type SelectOption, type WelderCertFilters } from "@react/features/certs/lib/certsView";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";

type WelderCertFiltersBarProps = {
  filters: WelderCertFilters;
  onChangeFilters: (next: WelderCertFilters) => void;
  welderFilterOptions: SelectOption[];
  materialFilterOptions: SelectOption[];
  jointTypeFilterOptions: SelectOption[];
};

export function WelderCertFiltersBar({
  filters,
  onChangeFilters,
  welderFilterOptions,
  materialFilterOptions,
  jointTypeFilterOptions,
}: WelderCertFiltersBarProps) {
  const setFilter = <K extends keyof WelderCertFilters>(key: K, value: WelderCertFilters[K]) => {
    onChangeFilters({ ...filters, [key]: value });
  };

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
      <AppSelect
        value={filters.welderId}
        onChange={(value) => setFilter("welderId", value)}
        data={welderFilterOptions}
        placeholder="Alle sveisere"
        clearable
      />
      <AppSelect
        value={filters.material}
        onChange={(value) => setFilter("material", value)}
        data={materialFilterOptions}
        placeholder="Alle materialer"
        clearable
      />
      <AppSelect
        value={filters.jointType}
        onChange={(value) => setFilter("jointType", value)}
        data={jointTypeFilterOptions}
        placeholder="Alle fugetyper"
        clearable
      />
      <AppSelect
        value={filters.status}
        onChange={(value) => setFilter("status", isCertStatus(value) ? value : "")}
        data={CERT_STATUS_OPTIONS}
        placeholder="Alle statuser"
        clearable
      />
      <AppTextInput
        value={filters.query}
        onChange={(value) => setFilter("query", value)}
        placeholder="Søk sertifikat, standard, sveiser..."
      />
    </SimpleGrid>
  );
}
