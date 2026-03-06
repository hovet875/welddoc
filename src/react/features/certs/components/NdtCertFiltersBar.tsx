import { SimpleGrid } from "@mantine/core";
import { CERT_STATUS_OPTIONS, isCertStatus, type NdtCertFilters, type SelectOption } from "@react/features/certs/lib/certsView";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";

type NdtCertFiltersBarProps = {
  filters: NdtCertFilters;
  onChangeFilters: (next: NdtCertFilters) => void;
  companyOptions: SelectOption[];
  methodOptions: SelectOption[];
};

export function NdtCertFiltersBar({
  filters,
  onChangeFilters,
  companyOptions,
  methodOptions,
}: NdtCertFiltersBarProps) {
  const setFilter = <K extends keyof NdtCertFilters>(key: K, value: NdtCertFilters[K]) => {
    onChangeFilters({ ...filters, [key]: value });
  };

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
      <AppSelect
        value={filters.company}
        onChange={(value) => setFilter("company", value)}
        data={companyOptions}
        placeholder="Alle firma"
        clearable
      />
      <AppSelect
        value={filters.method}
        onChange={(value) => setFilter("method", value)}
        data={methodOptions}
        placeholder="Alle metoder"
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
        placeholder="Søk sertifikat, kontrollør..."
      />
    </SimpleGrid>
  );
}
