import { Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import type { SystemUsageStats } from "@/repo/systemUsageRepo";
import { formatBytes, formatCount, prettifyTableName } from "../lib/systemUsageFormat";

type SystemUsageKpiGridProps = {
  stats: SystemUsageStats;
};

function KpiCard({ title, value, meta }: { title: string; value: string; meta: string }) {
  return (
    <Paper withBorder radius="lg" p="sm">
      <Stack gap={2}>
        <Text size="xs" c="dimmed">
          {title}
        </Text>
        <Text fw={700} size="lg">
          {value}
        </Text>
        <Text size="xs" c="dimmed">
          {meta}
        </Text>
      </Stack>
    </Paper>
  );
}

export function SystemUsageKpiGrid({ stats }: SystemUsageKpiGridProps) {
  const largestTable = stats.tableUsage[0];

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="sm">
      <KpiCard
        title="Total filstorage"
        value={formatBytes(stats.storage.totalBytes)}
        meta={`${formatCount(stats.storage.fileCount)} filer`}
      />
      <KpiCard title="Buckets" value={String(stats.storage.bucketUsage.length)} meta="Antall buckets med filer" />
      <KpiCard
        title="Største tabell"
        value={largestTable ? prettifyTableName(largestTable.tableName) : "Ingen data"}
        meta={largestTable ? `${formatBytes(largestTable.totalBytes)} / ${formatCount(largestTable.rowEstimate)} est. rader` : ""}
      />
    </SimpleGrid>
  );
}
