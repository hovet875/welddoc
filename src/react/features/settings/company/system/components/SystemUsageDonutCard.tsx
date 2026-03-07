import { ColorSwatch, Group, Paper, Stack, Text } from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import "@mantine/charts/styles.css";
import type { UsageDonutSegment } from "../lib/systemUsageFormat";

type SystemUsageDonutCardProps = {
  title: string;
  subtitle: string;
  emptyText: string;
  data: UsageDonutSegment[];
};

export function SystemUsageDonutCard({ title, subtitle, emptyText, data }: SystemUsageDonutCardProps) {
  return (
    <Paper withBorder radius="lg" p="sm">
      <Stack gap="sm">
        <Stack gap={0}>
          <Text fw={600}>{title}</Text>
          <Text size="xs" c="dimmed">
            {subtitle}
          </Text>
        </Stack>

        {data.length === 0 ? (
          <Text size="sm" c="dimmed">
            {emptyText}
          </Text>
        ) : (
          <Group align="flex-start" gap="md" wrap="nowrap">
            <DonutChart
              data={data.map((entry) => ({
                name: entry.name,
                value: entry.value,
                color: entry.color,
              }))}
              size={180}
              thickness={24}
              labelsType="percent"
              withLabelsLine
            />

            <Stack gap={6} miw={0}>
              {data.map((entry) => (
                <Group key={entry.name} gap={8} wrap="nowrap" align="flex-start">
                  <ColorSwatch color={entry.color} size={12} />
                  <Stack gap={0} miw={0}>
                    <Text size="xs" fw={600} truncate>
                      {entry.name}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {entry.valueLabel} - {entry.meta}
                    </Text>
                  </Stack>
                </Group>
              ))}
            </Stack>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
