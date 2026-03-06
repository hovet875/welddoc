import type { UbibotHourlyRow } from "../../../../repo/ubibotRepo";
import type {
  UbiBucket,
  UbiBucketOption,
  UbibotChartModel,
  UbibotChartModelInput,
  UbibotPoint,
  UbiSpan,
} from "../types";

const HOUR_FMT = new Intl.DateTimeFormat("nb-NO", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_FMT = new Intl.DateTimeFormat("nb-NO", {
  day: "2-digit",
  month: "2-digit",
});

const MONTH_FMT = new Intl.DateTimeFormat("nb-NO", {
  month: "short",
  year: "numeric",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "short",
  timeStyle: "short",
});

const EMPTY_LAST_UPDATED = "Sist oppdatert: - | Siste måling: -";

export function asSpan(value: string): UbiSpan {
  if (value === "7d" || value === "30d" || value === "90d" || value === "12m" || value === "month") return value;
  return "30d";
}

export function asBucket(value: string): UbiBucket {
  if (value === "hour" || value === "day" || value === "month") return value;
  return "hour";
}

export function currentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function asMonthValue(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  const fullDateMatch = /^(\d{4})-(0[1-9]|1[0-2])(?:-[0-3]\d)?(?:[T ].*)?$/.exec(raw);
  if (fullDateMatch) return `${fullDateMatch[1]}-${fullDateMatch[2]}`;
  return currentMonthValue();
}

function monthRange(monthValue: string) {
  const safeMonth = asMonthValue(monthValue);
  const [year, month] = safeMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return {
    monthValue: safeMonth,
    sinceIso: start.toISOString(),
    untilIsoExclusive: endExclusive.toISOString(),
  };
}

function monthLabel(monthValue: string) {
  const { sinceIso } = monthRange(monthValue);
  return MONTH_FMT.format(new Date(sinceIso));
}

function periodLabel(span: UbiSpan, monthValue: string): string {
  switch (span) {
    case "7d":
      return "7 dager";
    case "30d":
      return "30 dager";
    case "90d":
      return "90 dager";
    case "12m":
      return "12 måneder";
    case "month":
      return `Måned ${monthLabel(monthValue)}`;
  }
}

function spanToSinceIso(span: UbiSpan) {
  const now = new Date();
  const since = new Date(now);
  if (span === "7d") since.setDate(since.getDate() - 7);
  if (span === "30d") since.setDate(since.getDate() - 30);
  if (span === "90d") since.setDate(since.getDate() - 90);
  if (span === "12m") since.setMonth(since.getMonth() - 12);
  since.setMinutes(0, 0, 0);
  return since.toISOString();
}

function spanToLimit(span: UbiSpan) {
  if (span === "7d") return 500;
  if (span === "30d") return 1600;
  if (span === "90d") return 4200;
  if (span === "month") return 1800;
  return 12000;
}

export function fetchWindow(span: UbiSpan, monthValue: string) {
  if (span === "month") {
    const month = monthRange(monthValue);
    return {
      sinceIso: month.sinceIso,
      untilIsoExclusive: month.untilIsoExclusive,
      limit: spanToLimit(span),
    };
  }

  return {
    sinceIso: spanToSinceIso(span),
    untilIsoExclusive: undefined as string | undefined,
    limit: spanToLimit(span),
  };
}

function parseMillis(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function formatMillis(value: number | null): string {
  if (value == null) return "-";
  try {
    return DATE_TIME_FMT.format(new Date(value));
  } catch {
    return "-";
  }
}

function formatNumber(value: number | null, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function aggregateRows(rows: UbibotHourlyRow[], bucket: UbiBucket): UbibotPoint[] {
  if (bucket === "hour") {
    return rows
      .map((row) => {
        const atMs = parseMillis(row.bucket_start);
        if (atMs == null) return null;
        return {
          key: row.bucket_start,
          atMs,
          label: HOUR_FMT.format(new Date(atMs)),
          temp: isFiniteNumber(row.temp_avg) ? row.temp_avg : null,
          rh: isFiniteNumber(row.rh_avg) ? row.rh_avg : null,
          insertedAtMs: parseMillis(row.inserted_at),
        } satisfies UbibotPoint;
      })
      .filter((point): point is UbibotPoint => point != null);
  }

  type Agg = {
    key: string;
    atMs: number;
    tempWeightedSum: number;
    tempWeight: number;
    rhWeightedSum: number;
    rhWeight: number;
    insertedAtMs: number | null;
  };

  const grouped = new Map<string, Agg>();

  for (const row of rows) {
    const atMs = parseMillis(row.bucket_start);
    if (atMs == null) continue;

    const iso = new Date(atMs).toISOString();
    const key = bucket === "day" ? iso.slice(0, 10) : iso.slice(0, 7);
    const startMs = Date.parse(bucket === "day" ? `${key}T00:00:00.000Z` : `${key}-01T00:00:00.000Z`);
    if (!Number.isFinite(startMs)) continue;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        atMs: startMs,
        tempWeightedSum: 0,
        tempWeight: 0,
        rhWeightedSum: 0,
        rhWeight: 0,
        insertedAtMs: null,
      });
    }

    const agg = grouped.get(key)!;
    const weight = isFiniteNumber(row.samples) && row.samples > 0 ? row.samples : 1;

    if (isFiniteNumber(row.temp_avg)) {
      agg.tempWeightedSum += row.temp_avg * weight;
      agg.tempWeight += weight;
    }
    if (isFiniteNumber(row.rh_avg)) {
      agg.rhWeightedSum += row.rh_avg * weight;
      agg.rhWeight += weight;
    }

    const inserted = parseMillis(row.inserted_at);
    if (inserted != null && (agg.insertedAtMs == null || inserted > agg.insertedAtMs)) {
      agg.insertedAtMs = inserted;
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.atMs - b.atMs)
    .map((agg) => ({
      key: agg.key,
      atMs: agg.atMs,
      label: bucket === "day" ? DAY_FMT.format(new Date(agg.atMs)) : MONTH_FMT.format(new Date(agg.atMs)),
      temp: agg.tempWeight > 0 ? agg.tempWeightedSum / agg.tempWeight : null,
      rh: agg.rhWeight > 0 ? agg.rhWeightedSum / agg.rhWeight : null,
      insertedAtMs: agg.insertedAtMs,
    }));
}

function compressPoints(points: UbibotPoint[], maxPoints: number): UbibotPoint[] {
  if (points.length <= maxPoints) return points;

  const stride = Math.ceil(points.length / maxPoints);
  const out: UbibotPoint[] = [];

  for (let i = 0; i < points.length; i += stride) {
    const chunk = points.slice(i, i + stride);
    if (chunk.length === 0) continue;

    let tempSum = 0;
    let tempCount = 0;
    let rhSum = 0;
    let rhCount = 0;
    let insertedAtMs: number | null = null;

    for (const point of chunk) {
      if (isFiniteNumber(point.temp)) {
        tempSum += point.temp;
        tempCount += 1;
      }
      if (isFiniteNumber(point.rh)) {
        rhSum += point.rh;
        rhCount += 1;
      }
      if (point.insertedAtMs != null && (insertedAtMs == null || point.insertedAtMs > insertedAtMs)) {
        insertedAtMs = point.insertedAtMs;
      }
    }

    const last = chunk[chunk.length - 1];
    out.push({
      key: last.key,
      atMs: last.atMs,
      label: last.label,
      temp: tempCount > 0 ? tempSum / tempCount : null,
      rh: rhCount > 0 ? rhSum / rhCount : null,
      insertedAtMs,
    });
  }

  return out;
}

function valueDomain(values: number[], fallback: [number, number]): [number, number] {
  if (values.length === 0) return fallback;

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

export function bucketsForSpan(span: UbiSpan): UbiBucketOption[] {
  if (span === "12m") return [{ value: "day", label: "Per dag" }, { value: "month", label: "Per måned" }];
  if (span === "90d") return [{ value: "day", label: "Per dag" }];
  return [{ value: "hour", label: "Per time" }, { value: "day", label: "Per dag" }];
}

export function defaultBucketForSpan(span: UbiSpan): UbiBucket {
  if (span === "12m") return "month";
  if (span === "90d") return "day";
  if (span === "30d") return "day";
  if (span === "month") return "day";
  return "hour";
}

export function buildUbibotChartModel({
  rows,
  span,
  monthValue,
  bucket,
  loading,
  loadError,
  emptyMessage,
}: UbibotChartModelInput): UbibotChartModel {
  if (loading && rows.length === 0 && !loadError && !emptyMessage) {
    return {
      kind: "loading",
      message: "Laster klimadata...",
      lastUpdatedText: EMPTY_LAST_UPDATED,
    };
  }

  if (loadError) {
    return {
      kind: "error",
      message: loadError,
      lastUpdatedText: EMPTY_LAST_UPDATED,
    };
  }

  if (emptyMessage) {
    return {
      kind: "empty",
      message: emptyMessage,
      lastUpdatedText: EMPTY_LAST_UPDATED,
    };
  }

  if (rows.length === 0) {
    return {
      kind: "empty",
      message: `Ingen målinger for ${periodLabel(span, monthValue).toLowerCase()}.`,
      lastUpdatedText: EMPTY_LAST_UPDATED,
    };
  }

  const points = aggregateRows(rows, bucket);
  if (points.length === 0) {
    return {
      kind: "empty",
      message: "Fant ikke gyldige målinger i valgt periode.",
      lastUpdatedText: EMPTY_LAST_UPDATED,
    };
  }

  const displayPoints = compressPoints(points, bucket === "hour" ? 420 : 900);
  const tempValues = points.map((point) => point.temp).filter(isFiniteNumber);
  const rhValues = points.map((point) => point.rh).filter(isFiniteNumber);

  if (tempValues.length === 0 && rhValues.length === 0) {
    return {
      kind: "empty",
      message: "Målingene mangler temperatur- og fuktverdier.",
      lastUpdatedText: EMPTY_LAST_UPDATED,
    };
  }

  const tempMin = tempValues.length > 0 ? Math.min(...tempValues) : null;
  const tempMax = tempValues.length > 0 ? Math.max(...tempValues) : null;
  const rhMin = rhValues.length > 0 ? Math.min(...rhValues) : null;
  const rhMax = rhValues.length > 0 ? Math.max(...rhValues) : null;

  let rhWeightedSum = 0;
  let rhWeight = 0;
  for (const row of rows) {
    if (!isFiniteNumber(row.rh_avg)) continue;
    const weight = isFiniteNumber(row.samples) && row.samples > 0 ? row.samples : 1;
    rhWeightedSum += row.rh_avg * weight;
    rhWeight += weight;
  }
  const avgRh = rhWeight > 0
    ? rhWeightedSum / rhWeight
    : (rhValues.length > 0 ? rhValues.reduce((sum, value) => sum + value, 0) / rhValues.length : null);

  let latestInsertedMs: number | null = null;
  let latestMeasurementMs: number | null = null;
  for (const row of rows) {
    const insertedMs = parseMillis(row.inserted_at);
    if (insertedMs != null && (latestInsertedMs == null || insertedMs > latestInsertedMs)) {
      latestInsertedMs = insertedMs;
    }
    const measurementMs = parseMillis(row.bucket_start);
    if (measurementMs != null && (latestMeasurementMs == null || measurementMs > latestMeasurementMs)) {
      latestMeasurementMs = measurementMs;
    }
  }
  const lastUpdatedText = `Sist oppdatert: ${formatMillis(latestInsertedMs)} | Siste måling: ${formatMillis(latestMeasurementMs)}`;
  const tempDomain = valueDomain(tempValues, [0, 30]);
  const rhDomain = valueDomain(rhValues, [20, 80]);

  const chartPoints = displayPoints.map((point) => ({
    label: point.label,
    temp: point.temp,
    rh: point.rh,
  }));

  const note = displayPoints.length < points.length
    ? `Viser ${displayPoints.length} punkter (aggregert fra ${points.length}).`
    : null;

  return {
    kind: "data",
    lastUpdatedText,
    avgRhLabel: `${formatNumber(avgRh)}%`,
    points: chartPoints,
    tempDomain,
    rhDomain,
    tempMinLabel: formatNumber(tempMin),
    tempMaxLabel: formatNumber(tempMax),
    rhMinLabel: formatNumber(rhMin),
    rhMaxLabel: formatNumber(rhMax),
    note,
  };
}
