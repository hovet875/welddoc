import { useLayoutEffect, useRef, useState } from "react";
import { LineChart } from "@mantine/charts";
import { Alert, Box, Stack, Text } from "@mantine/core";
import type { UbibotChartModel } from "../types";
import "@mantine/charts/styles.css";

type UbibotChartProps = {
  model: UbibotChartModel;
};

export function UbibotChart({ model }: UbibotChartProps) {
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useLayoutEffect(() => {
    if (model.kind !== "data") {
      setChartReady(false);
      return;
    }

    const node = chartHostRef.current;
    if (!node) return;

    const measure = () => {
      setChartReady(node.getBoundingClientRect().width > 0);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [model.kind]);

  switch (model.kind) {
    case "error":
      return (
        <Alert color="red" variant="light">
          {model.message}
        </Alert>
      );
    case "loading":
      return null;
    case "empty":
      return (
        <Text c="dimmed" ta="center">
          {model.message}
        </Text>
      );
    case "data":
      return (
        <Stack gap="xs" style={{ minWidth: 0 }}>
          <Text c="dimmed" size="sm" ta="center">
            Gjennomsnittlig målt luftfuktighet <Text component="strong" inherit c="textPrimary">{model.avgRhLabel}</Text>
          </Text>

          <Box ref={chartHostRef} style={{ minWidth: 0, width: "100%", minHeight: 280 }}>
            {chartReady ? (
              <LineChart
                h={280}
                data={model.points}
                dataKey="label"
                series={[
                  { name: "temp", label: "Temperatur", color: "orange.4", yAxisId: "left" },
                  { name: "rh", label: "Luftfuktighet", color: "brand.4", yAxisId: "right" },
                ]}
                withLegend
                withDots={false}
                strokeWidth={2.3}
                withRightYAxis
                yAxisProps={{
                  yAxisId: "left",
                  domain: model.tempDomain,
                  width: 60,
                  tickFormatter: (value) => `${Number(value).toFixed(1)}°`,
                }}
                rightYAxisProps={{
                  yAxisId: "right",
                  domain: model.rhDomain,
                  width: 60,
                  tickFormatter: (value) => `${Number(value).toFixed(1)}%`,
                }}
                valueFormatter={(value) => `${Number(value).toFixed(1)}`}
                xAxisProps={{ interval: "preserveStartEnd" }}
              />
            ) : null}
          </Box>

          <Text c="dimmed" size="xs" ta="center">
            Temperatur | min {model.tempMinLabel}° / maks {model.tempMaxLabel}°  •  Luftfuktighet | min {model.rhMinLabel}% / maks {model.rhMaxLabel}%
          </Text>

          {model.note ? (
            <Text c="dimmed" size="xs" ta="center">
              {model.note}
            </Text>
          ) : null}
        </Stack>
      );
  }
}
