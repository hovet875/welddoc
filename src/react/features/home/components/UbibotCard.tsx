import { useMemo } from "react";
import { Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { AppMonthPicker } from "@react/ui/AppMonthPicker";
import { AppPanel } from "@react/ui/AppPanel";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppSelect } from "@react/ui/AppSelect";
import { asMonthValue, buildUbibotChartModel } from "../lib/ubibotChart";
import { useUbibotData } from "../hooks/useUbibotData";
import { UbibotChart } from "./UbibotChart";

const SPAN_OPTIONS = [
  { value: "7d", label: "7 dager" },
  { value: "30d", label: "30 dager" },
  { value: "90d", label: "90 dager" },
  { value: "12m", label: "12 måneder" },
  { value: "month", label: "Valgt måned" },
];

export function UbibotCard() {
  const {
    span,
    monthValue,
    bucket,
    rows,
    loading,
    loadingRows,
    loadError,
    emptyMessage,
    showMonth,
    bucketOptions,
    setSpanValue,
    setMonthValue,
    setBucketValue,
    refresh,
  } = useUbibotData();

  const chartModel = useMemo(
    () => buildUbibotChartModel({ rows, span, monthValue, bucket, loading, loadError, emptyMessage }),
    [rows, span, monthValue, bucket, loading, loadError, emptyMessage]
  );

  return (
    <AppPanel
      title={
        <Text fw={700} size="lg">
          Klimalogging sveisetilsett
        </Text>
      }
      actions={<AppRefreshIconButton title="Oppdater" disabled={loading} loading={loadingRows} onClick={refresh} />}
    >
      <Stack gap="md">
        <SimpleGrid cols={showMonth ? { base: 1, md: 3 } : { base: 1, md: 2 }} spacing="sm">
          <Stack gap={6}>
            <Text c="dimmed" size="xs" fw={600}>
              Periode
            </Text>
            <AppSelect value={span} disabled={loading} data={SPAN_OPTIONS} onChange={setSpanValue} />
          </Stack>

          {showMonth ? (
            <Stack gap={6}>
              <Text c="dimmed" size="xs" fw={600}>
                Måned
              </Text>
              <AppMonthPicker value={asMonthValue(monthValue)} disabled={loading || !showMonth} onChange={setMonthValue} />
            </Stack>
          ) : null}

          <Stack gap={6}>
            <Text c="dimmed" size="xs" fw={600}>
              Visning
            </Text>
            <AppSelect value={bucket} disabled={loading} data={bucketOptions} onChange={setBucketValue} />
          </Stack>
        </SimpleGrid>

        <Paper withBorder radius="lg" p="sm">
          <UbibotChart model={chartModel} />
        </Paper>

        <Text c="dimmed" size="xs" ta="center">
          {chartModel.lastUpdatedText}
        </Text>
      </Stack>
    </AppPanel>
  );
}
