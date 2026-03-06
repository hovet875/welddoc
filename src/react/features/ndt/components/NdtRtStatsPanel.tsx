import { useLayoutEffect, useRef, useState } from "react";
import { Box, Group, Paper, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NdtRtStatsRow } from "@/repo/ndtReportRepo";
import { AppPanel } from "@react/ui/AppPanel";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import { computeRtYearStatsFromRtRows, rateTone } from "../lib/ndtView";

type NdtRtStatsPanelProps = {
  rows: NdtRtStatsRow[];
  activeWelderId: string;
};

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function roundAxisMax(value: number) {
  if (value <= 2) return 2;
  if (value <= 5) return Math.ceil(value * 2) / 2;
  if (value <= 10) return Math.ceil(value);
  return Math.ceil(value / 2) * 2;
}

export function NdtRtStatsPanel({ rows, activeWelderId }: NdtRtStatsPanelProps) {
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(320);

  useLayoutEffect(() => {
    const node = chartHostRef.current;
    if (!node) return;

    const resolveWidth = () => {
      const selfWidth = node.getBoundingClientRect().width;
      const parentWidth = node.parentElement?.getBoundingClientRect().width ?? 0;
      const viewportFallback = Math.max(window.innerWidth - 120, 320);
      const width = selfWidth || parentWidth || viewportFallback;
      return Math.max(320, Math.floor(width));
    };

    const measure = () => {
      setChartWidth(resolveWidth());
    };

    measure();

    const frameA = window.requestAnimationFrame(measure);
    const frameB = window.requestAnimationFrame(() => window.requestAnimationFrame(measure));
    const timeoutA = window.setTimeout(measure, 80);
    const timeoutB = window.setTimeout(measure, 220);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
      window.clearTimeout(timeoutA);
      window.clearTimeout(timeoutB);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const yearStats = computeRtYearStatsFromRtRows(rows, activeWelderId);
  const chartData = yearStats.map((row) => ({
    year: String(row.year),
    rate: Number(row.rate.toFixed(2)),
  }));

  if (yearStats.length === 0) {
    return (
      <AppPanel title="Statistikk" meta="Feilrate og antall kontrollerte sveiser">
        <Text c="dimmed">Ingen RT-rapporter for valgt utvalg.</Text>
      </AppPanel>
    );
  }

  const totalWelds = yearStats.reduce((sum, row) => sum + row.welds, 0);
  const totalDefects = yearStats.reduce((sum, row) => sum + row.defects, 0);
  const totalRate = totalWelds > 0 ? (totalDefects / totalWelds) * 100 : 0;
  const axisMax = roundAxisMax(Math.max(2, ...yearStats.map((row) => row.rate)));
  const isSmallDataset = yearStats.length <= 2;
  const chartHeight = isSmallDataset ? 190 : 240;
  const renderedChartWidth = isSmallDataset ? Math.min(chartWidth, 920) : chartWidth;
  return (
    <AppPanel title="Statistikk" meta="Feilrate og antall kontrollerte sveiser">
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Paper withBorder radius="md" p="sm">
            <Group justify="space-between" align="center">
              <Text size="sm">Samlet feilrate</Text>
              <AppStatusBadge tone={rateTone(totalRate)}>{formatPercent(totalRate)}</AppStatusBadge>
            </Group>
          </Paper>
          <Paper withBorder radius="md" p="sm">
            <Group justify="space-between" align="center">
              <Text size="sm">Antall feil</Text>
              <Text fw={700}>{totalDefects}</Text>
            </Group>
          </Paper>
          <Paper withBorder radius="md" p="sm">
            <Group justify="space-between" align="center">
              <Text size="sm">Røntgede sveis</Text>
              <Text fw={700}>{totalWelds}</Text>
            </Group>
          </Paper>
        </SimpleGrid>

        <Box ref={chartHostRef} mt="xs" w="100%" miw={1} mih={chartHeight}>
          <Box w="100%" style={{ display: "flex", justifyContent: "center" }}>
          <RechartsBarChart
            width={renderedChartWidth}
            height={chartHeight}
            data={chartData}
            margin={{ top: 28, right: 24, left: 8, bottom: 0 }}
            barCategoryGap={isSmallDataset ? "72%" : "36%"}
          >
            <CartesianGrid
              stroke="color-mix(in srgb, var(--mantine-color-brand-7) 36%, transparent)"
              strokeDasharray="5 5"
              vertical={false}
            />
            <XAxis
              dataKey="year"
              axisLine={false}
              tickLine={{ stroke: "currentColor" }}
              tick={{ fill: "var(--mantine-color-dimmed)", fontSize: 12 }}
              padding={{ left: 24, right: 24 }}
            />
            <YAxis
              domain={[0, axisMax]}
              allowDecimals
              axisLine={false}
              tickLine={{ stroke: "currentColor" }}
              tick={{ fill: "var(--mantine-color-dimmed)", fontSize: 12 }}
              tickFormatter={(value) => formatPercent(Number(value))}
            />
            <Tooltip
              cursor={false}
              formatter={(value) => formatPercent(Number(value))}
              contentStyle={{
                background: "var(--mantine-color-body)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
              }}
              labelStyle={{ color: "var(--text)" }}
              itemStyle={{ color: "var(--text)" }}
            />
            <ReferenceLine
              y={2}
              stroke="var(--mantine-color-yellow-6)"
              label={{
                value: "Mål 2%",
                fill: "var(--mantine-color-yellow-5)",
                fontSize: 12,
                position: "insideBottomLeft",
              }}
            />
            <Bar
              dataKey="rate"
              name="RT-rate"
              fill="var(--mantine-color-brand-6)"
              maxBarSize={isSmallDataset ? 120 : 52}
            >
              <LabelList
                dataKey="rate"
                position="top"
                offset={6}
                fill="var(--mantine-color-gray-0)"
                formatter={(value: unknown) => formatPercent(Number(value))}
              />
            </Bar>
          </RechartsBarChart>
          </Box>
        </Box>

        <Table.ScrollContainer minWidth={520}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>År</Table.Th>
                <Table.Th>Røntgede sveiser</Table.Th>
                <Table.Th>Røntgenfeil</Table.Th>
                <Table.Th>Feilrate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {yearStats
                .slice()
                .sort((a, b) => b.year - a.year)
                .map((row) => (
                  <Table.Tr key={row.year}>
                    <Table.Td>{row.year}</Table.Td>
                    <Table.Td>{row.welds}</Table.Td>
                    <Table.Td>{row.defects}</Table.Td>
                    <Table.Td>
                      <AppStatusBadge tone={rateTone(row.rate)}>{formatPercent(row.rate)}</AppStatusBadge>
                    </Table.Td>
                  </Table.Tr>
                ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </AppPanel>
  );
}
