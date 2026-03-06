import type { UbibotHourlyRow } from "../../../repo/ubibotRepo";

export type UbiSpan = "7d" | "30d" | "90d" | "12m" | "month";
export type UbiBucket = "hour" | "day" | "month";

export type UbiBucketOption = {
  value: UbiBucket;
  label: string;
};

export type UbibotPoint = {
  key: string;
  atMs: number;
  label: string;
  temp: number | null;
  rh: number | null;
  insertedAtMs: number | null;
};

export type UbibotChartMessageModel = {
  kind: "loading" | "error" | "empty";
  message: string;
  lastUpdatedText: string;
};

export type UbibotChartDataModel = {
  kind: "data";
  lastUpdatedText: string;
  avgRhLabel: string;
  points: Array<{
    label: string;
    temp: number | null;
    rh: number | null;
  }>;
  tempDomain: [number, number];
  rhDomain: [number, number];
  tempMinLabel: string;
  tempMaxLabel: string;
  rhMinLabel: string;
  rhMaxLabel: string;
  note: string | null;
};

export type UbibotChartModel = UbibotChartMessageModel | UbibotChartDataModel;

export type UbibotChartModelInput = {
  rows: UbibotHourlyRow[];
  span: UbiSpan;
  monthValue: string;
  bucket: UbiBucket;
  loading: boolean;
  loadError: string | null;
  emptyMessage: string | null;
};
