import { Alert, Button, Group, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { useCompanySystemStats } from "../hooks/useCompanySystemStats";
import {
  buildStorageUsageSegments,
  buildTableUsageSegments,
  formatGeneratedAt,
} from "../lib/systemUsageFormat";
import { SystemTableUsageTable } from "./SystemTableUsageTable";
import { SystemUsageDonutCard } from "./SystemUsageDonutCard";
import { SystemUsageKpiGrid } from "./SystemUsageKpiGrid";

export function CompanySystemAppConfigPanel() {
  const { loading, refreshing, error, stats, reload } = useCompanySystemStats({ enabled: true });

  const bucketSegments = useMemo(
    () => (stats ? buildStorageUsageSegments(stats.storage.bucketUsage) : []),
    [stats]
  );
  const typeSegments = useMemo(() => (stats ? buildStorageUsageSegments(stats.storage.typeUsage) : []), [stats]);
  const tableSegments = useMemo(
    () => (stats ? buildTableUsageSegments(stats.tableUsage) : { segments: [], modeLabel: "bytes" as const }),
    [stats]
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="xs" c="dimmed">
          {stats ? `Oppdatert: ${formatGeneratedAt(stats.generatedAt)}` : "Henter statistikk..."}
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconRefresh size={14} />}
          onClick={() => {
            void reload();
          }}
          loading={loading || refreshing}
        >
          Oppdater
        </Button>
      </Group>

      {error ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      ) : null}

      {loading && !stats ? (
        <Stack gap="sm">
          <Skeleton height={88} radius="lg" />
          <Skeleton height={220} radius="lg" />
          <Skeleton height={220} radius="lg" />
        </Stack>
      ) : null}

      {stats ? (
        <>
          <SystemUsageKpiGrid stats={stats} />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <SystemUsageDonutCard
              title="Storage per bucket"
              subtitle="Fordeling på Supabase storage-buckets."
              emptyText="Ingen bucket-data tilgjengelig."
              data={bucketSegments}
            />

            <SystemUsageDonutCard
              title="Storage per filtype"
              subtitle="Fordeling etter filtype i files-tabellen."
              emptyText="Ingen filtype-data tilgjengelig."
              data={typeSegments}
            />
          </SimpleGrid>

          <SystemUsageDonutCard
            title="Tabeller som tar plass"
            subtitle={`Fordeling basert på ${tableSegments.modeLabel}.`}
            emptyText="Ingen tabell-data tilgjengelig."
            data={tableSegments.segments}
          />

          <SystemTableUsageTable rows={stats.tableUsage} />
        </>
      ) : null}
    </Stack>
  );
}
