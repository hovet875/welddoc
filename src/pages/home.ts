import { getSession, getProfileAccess } from "../app/auth";
import { renderHeader, wireHeader } from "../components/header";
import { Footer } from "../components/footer";
import { fetchUbibotChannels, fetchUbibotHourlyByChannel, type UbibotHourlyRow } from "../repo/ubibotRepo";
import { esc, qs } from "../utils/dom";

type UbiSpan = "7d" | "30d" | "90d" | "12m" | "month";
type UbiBucket = "hour" | "day" | "month";

type UbibotPoint = {
  key: string;
  atMs: number;
  label: string;
  temp: number | null;
  rh: number | null;
  insertedAtMs: number | null;
};

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

function asSpan(value: string): UbiSpan {
  if (value === "7d" || value === "30d" || value === "90d" || value === "12m" || value === "month") return value;
  return "30d";
}

function asBucket(value: string): UbiBucket {
  if (value === "hour" || value === "day" || value === "month") return value;
  return "hour";
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

function currentMonthValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function asMonthValue(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return currentMonthValue();
}

function monthRange(monthValue: string) {
  const safeMonth = asMonthValue(monthValue);
  const [y, m] = safeMonth.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
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

function fetchWindow(span: UbiSpan, monthValue: string) {
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

    const d = new Date(atMs);
    const iso = d.toISOString();
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

function pickTickIndices(total: number, maxTicks = 6): number[] {
  if (total <= 0) return [];
  if (total <= maxTicks) return Array.from({ length: total }, (_, idx) => idx);

  const out = new Set<number>([0, total - 1]);
  const inner = maxTicks - 2;
  const step = (total - 1) / (inner + 1);
  for (let i = 1; i <= inner; i += 1) {
    out.add(Math.round(i * step));
  }
  return Array.from(out).sort((a, b) => a - b);
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

function buildLinePath(
  points: UbibotPoint[],
  getValue: (point: UbibotPoint) => number | null,
  xFor: (idx: number) => number,
  yFor: (value: number) => number
) {
  let d = "";
  let drawing = false;

  for (let i = 0; i < points.length; i += 1) {
    const value = getValue(points[i]);
    if (!isFiniteNumber(value)) {
      drawing = false;
      continue;
    }
    const x = xFor(i);
    const y = yFor(value);
    d += `${drawing ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)} `;
    drawing = true;
  }
  return d.trim();
}

export async function renderHome(app: HTMLElement) {
  const session = await getSession();
  let displayName = "Bruker";
  const email = session?.user?.email ?? "";

  if (session?.user) {
    try {
      const access = await getProfileAccess(session.user);
      displayName = access.displayName;
    } catch (err) {
      console.warn("Feilet å hente brukerprofil", err);
    }
  }

  app.innerHTML = `
    <div class="shell page-home">
      ${renderHeader(displayName, email)}
      <main class="main">
      <section class="section">
          <div class="tiles">
            <div class="tile">
              <div class="tileh">Sveis</div>
              <div class="tilep">Hurtigregistrer sveis i sveiselogg.</div>
            </div>
            <div class="tile">
              <div class="tileh">Sporbarhet</div>
              <div class="tilep">Hurtigregistrer sporbarhet i prosjekt.</div>
            </div>
            <div class="tile">
              <div class="tileh">Dokumenter</div>
              <div class="tilep">PDF-tegninger, MTC, NDT-rapporter og vedlegg.</div>
            </div>
          </div>
        </section>
        <section class="hero">
          <div class="herotext">
            <h1>Dokumentasjon som faktisk funker i verkstedet.</h1>
            <p>
              Ett system for prosjekter, tegninger, sveiselogger, materialsertifikater og kontrollrapporter.
              Bygd for rask registrering og enkel eksport.
            </p>

            <div class="cta">
              <a class="btn primary" href="#/prosjekter">Åpne prosjekter</a>
              <a class="btn" href="#/prosjekter">Ny sveiselog</a>
            </div>

            <div class="quick">
              <div class="pill">Prosjektstyrt struktur</div>
              <div class="pill">Klar for QR / sporbarhet</div>
              <div class="pill">Klar for PDF-export</div>
            </div>
          </div>

          <div class="herocard">
            <div class="ub-head">
              <span class="ub-title">Klimalogging sveisetilsett</span>
              <button type="button" class="btn small ub-refresh-btn" data-ub-refresh aria-label="Oppdater">
                <span class="ub-refresh-wheel" aria-hidden="true">↻</span>
              </button>
            </div>

            <div class="ub-controls">
              <label class="ub-field">
                <span>Periode</span>
                <select class="select" data-ub-span>
                  <option value="7d">7 dager</option>
                  <option value="30d" selected>30 dager</option>
                  <option value="90d">90 dager</option>
                  <option value="12m">12 måneder</option>
                  <option value="month">Valgt måned</option>
                </select>
              </label>
              <label class="ub-field ub-month-field" data-ub-month-wrap hidden>
                <span>Måned</span>
                <input class="input" type="month" data-ub-month />
              </label>
              <label class="ub-field">
                <span>Visning</span>
                <select class="select" data-ub-bucket>
                  <option value="day" selected>Per dag</option>
                  <option value="hour">Per time</option>
                </select>
              </label>
            </div>
            <div class="ub-chart" data-ub-chart>
              <div class="muted">Laster klimadata...</div>
            </div>
            <div class="ub-foot muted" data-ub-last-updated>Sist oppdatert: -</div>
          </div>
        </section>
      </main>
      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const ubControls = qs<HTMLDivElement>(app, ".ub-controls");
  const ubSpan = qs<HTMLSelectElement>(app, "[data-ub-span]");
  const ubMonthWrap = qs<HTMLLabelElement>(app, "[data-ub-month-wrap]");
  const ubMonth = qs<HTMLInputElement>(app, "[data-ub-month]");
  const ubBucket = qs<HTMLSelectElement>(app, "[data-ub-bucket]");
  const ubRefresh = qs<HTMLButtonElement>(app, "[data-ub-refresh]");
  const ubChart = qs<HTMLDivElement>(app, "[data-ub-chart]");
  const ubLastUpdated = qs<HTMLDivElement>(app, "[data-ub-last-updated]");

  const ubiState: {
    channelId: string;
    span: UbiSpan;
    monthValue: string;
    bucket: UbiBucket;
    rows: UbibotHourlyRow[];
    loading: boolean;
  } = {
    channelId: "",
    span: asSpan(ubSpan.value),
    monthValue: currentMonthValue(),
    bucket: asBucket(ubBucket.value),
    rows: [],
    loading: false,
  };

  const syncMonthField = () => {
    const showMonth = ubiState.span === "month";
    ubMonthWrap.hidden = !showMonth;
    ubControls.classList.toggle("has-month", showMonth);
    ubMonth.disabled = ubiState.loading || !showMonth;
    if (showMonth) {
      ubMonth.value = asMonthValue(ubiState.monthValue);
    }
  };

  ubMonth.value = ubiState.monthValue;
  syncMonthField();

  const bucketsForSpan = (span: UbiSpan): Array<{ value: UbiBucket; label: string }> => {
    if (span === "12m") return [{ value: "day", label: "Per dag" }, { value: "month", label: "Per måned" }];
    if (span === "90d") return [{ value: "day", label: "Per dag" }];
    return [{ value: "hour", label: "Per time" }, { value: "day", label: "Per dag" }];
  };

  const defaultBucketForSpan = (span: UbiSpan): UbiBucket => {
    if (span === "12m") return "month";
    if (span === "90d") return "day";
    if (span === "30d") return "day";
    if (span === "month") return "day";
    return "hour";
  };

  const syncBucketOptions = (forceDefault = false) => {
    const options = bucketsForSpan(ubiState.span);
    const hasCurrent = options.some((opt) => opt.value === ubiState.bucket);
    const next = forceDefault || !hasCurrent ? defaultBucketForSpan(ubiState.span) : ubiState.bucket;
    ubiState.bucket = next;
    ubBucket.innerHTML = options.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join("");
    ubBucket.value = next;
  };

  syncBucketOptions(true);

  const setLoading = (loading: boolean) => {
    ubiState.loading = loading;
    ubRefresh.disabled = loading;
    ubRefresh.classList.toggle("is-loading", loading);
    ubSpan.disabled = loading;
    ubBucket.disabled = loading;
    syncMonthField();
  };

  const renderEmpty = (message: string) => {
    ubChart.innerHTML = `<div class="muted">${esc(message)}</div>`;
    ubLastUpdated.textContent = "Sist oppdatert: - | Siste måling: -";
  };

  const renderGraph = () => {
    const rows = ubiState.rows;
    if (rows.length === 0) {
      renderEmpty(`Ingen målinger for ${periodLabel(ubiState.span, ubiState.monthValue).toLowerCase()}.`);
      return;
    }

    const points = aggregateRows(rows, ubiState.bucket);
    if (points.length === 0) {
      renderEmpty("Fant ikke gyldige målinger i valgt periode.");
      return;
    }

    const displayPoints = compressPoints(points, ubiState.bucket === "hour" ? 420 : 900);
    const tempValues = points.map((p) => p.temp).filter(isFiniteNumber);
    const rhValues = points.map((p) => p.rh).filter(isFiniteNumber);

    if (tempValues.length === 0 && rhValues.length === 0) {
      renderEmpty("Målingene mangler temperatur- og fuktverdier.");
      return;
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

    ubLastUpdated.textContent = `Sist oppdatert: ${formatMillis(latestInsertedMs)} | Siste måling: ${formatMillis(latestMeasurementMs)}`;

    const viewW = 760;
    const viewH = 268;
    const padL = 56;
    const padR = 64;
    const padT = 16;
    const padB = 40;
    const chartW = viewW - padL - padR;
    const chartH = viewH - padT - padB;

    const xFor = (idx: number) =>
      displayPoints.length <= 1 ? padL + chartW / 2 : padL + (idx / (displayPoints.length - 1)) * chartW;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const tempDomain = valueDomain(tempValues, [0, 30]);
    const rhDomain = valueDomain(rhValues, [20, 80]);

    const yForTemp = (value: number) => {
      const v = clamp(value, tempDomain[0], tempDomain[1]);
      return padT + (1 - (v - tempDomain[0]) / (tempDomain[1] - tempDomain[0])) * chartH;
    };

    const yForRh = (value: number) => {
      const v = clamp(value, rhDomain[0], rhDomain[1]);
      return padT + (1 - (v - rhDomain[0]) / (rhDomain[1] - rhDomain[0])) * chartH;
    };

    const tempPath = buildLinePath(displayPoints, (point) => point.temp, xFor, yForTemp);
    const rhPath = buildLinePath(displayPoints, (point) => point.rh, xFor, yForRh);

    const ySteps = 4;
    const yGrid = Array.from({ length: ySteps + 1 }, (_, idx) => {
      const ratio = idx / ySteps;
      const y = padT + (1 - ratio) * chartH;
      const tempValue = tempDomain[0] + (tempDomain[1] - tempDomain[0]) * ratio;
      const rhValue = rhDomain[0] + (rhDomain[1] - rhDomain[0]) * ratio;
      return `
        <line x1="${padL}" y1="${y.toFixed(2)}" x2="${viewW - padR}" y2="${y.toFixed(2)}"></line>
        <text class="ub-axis-label ub-axis-label-left" x="${padL - 10}" y="${(y + 4).toFixed(2)}" text-anchor="end">${esc(formatNumber(tempValue))} &deg;C</text>
        <text class="ub-axis-label ub-axis-label-right" x="${viewW - padR + 10}" y="${(y + 4).toFixed(2)}" text-anchor="start">${esc(formatNumber(rhValue))} %</text>
      `;
    }).join("");

    const xTicks = pickTickIndices(displayPoints.length, 7)
      .map((idx) => {
        const point = displayPoints[idx];
        if (!point) return "";
        const x = xFor(idx);
        return `<text class="ub-x-label" x="${x.toFixed(2)}" y="${viewH - 12}" text-anchor="middle">${esc(point.label)}</text>`;
      })
      .join("");

    const latestTempIdx = (() => {
      for (let i = displayPoints.length - 1; i >= 0; i -= 1) {
        if (isFiniteNumber(displayPoints[i]?.temp)) return i;
      }
      return -1;
    })();

    const latestRhIdx = (() => {
      for (let i = displayPoints.length - 1; i >= 0; i -= 1) {
        if (isFiniteNumber(displayPoints[i]?.rh)) return i;
      }
      return -1;
    })();

    const tempMarker =
      latestTempIdx >= 0
        ? `<circle class="ub-point ub-point-temp" cx="${xFor(latestTempIdx).toFixed(2)}" cy="${yForTemp(displayPoints[latestTempIdx].temp!).toFixed(2)}" r="3.8"></circle>`
        : "";

    const rhMarker =
      latestRhIdx >= 0
        ? `<circle class="ub-point ub-point-rh" cx="${xFor(latestRhIdx).toFixed(2)}" cy="${yForRh(displayPoints[latestRhIdx].rh!).toFixed(2)}" r="3.8"></circle>`
        : "";

    const notes: string[] = [];
    if (displayPoints.length < points.length) {
      notes.push(`Viser ${displayPoints.length} punkter (aggregert fra ${points.length}).`);
    }
    const compactInfo = notes.length > 0
      ? `<div class="ub-note muted">${esc(notes.join(" "))}</div>`
      : "";

    ubChart.innerHTML = `
      <div class="ub-nowtemp">Gjennomsnittlig målt luftfuktighet <strong>${esc(formatNumber(avgRh))}%</strong></div>
      <svg viewBox="0 0 ${viewW} ${viewH}" role="img" aria-label="Temperatur og luftfuktighet fra UbiBot">
        <g class="ub-grid">${yGrid}</g>
        <g class="ub-axis">${xTicks}</g>
        ${rhPath ? `<path class="ub-rh-line" d="${rhPath}"></path>` : ""}
        ${tempPath ? `<path class="ub-temp-line" d="${tempPath}"></path>` : ""}
        ${tempMarker}
        ${rhMarker}
      </svg>
      <div class="ub-legend ub-legend-block">
        <span class="ub-legend-item"><span class="ub-legend-swatch ub-legend-temp"></span>Temperatur | min ${esc(formatNumber(tempMin))}&deg;C / maks ${esc(formatNumber(tempMax))}&deg;C</span>
        <span class="ub-legend-item"><span class="ub-legend-swatch ub-legend-rh"></span>Luftfuktighet | min ${esc(formatNumber(rhMin))}% / maks ${esc(formatNumber(rhMax))}%</span>
      </div>
      ${compactInfo}
    `;
  };

  const reloadRows = async () => {
    if (!ubiState.channelId) {
      renderEmpty("Ingen UbiBot-data tilgjengelig.");
      return;
    }

    setLoading(true);
    try {
      const window = fetchWindow(ubiState.span, ubiState.monthValue);
      ubiState.rows = await fetchUbibotHourlyByChannel(ubiState.channelId, {
        sinceIso: window.sinceIso,
        untilIsoExclusive: window.untilIsoExclusive,
        limit: window.limit,
      });
      renderGraph();
    } catch (err) {
      console.error("Failed to load UbiBot rows", err);
      ubChart.innerHTML = `<div class="err">Klarte ikke hente klimadata.</div>`;
      ubLastUpdated.textContent = "Sist oppdatert: - | Siste måling: -";
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultChannel = async () => {
    setLoading(true);
    try {
      const channels = await fetchUbibotChannels();
      if (channels.length === 0) {
        ubiState.channelId = "";
        ubiState.rows = [];
        renderEmpty("Ingen UbiBot-data tilgjengelig.");
        return;
      }

      ubiState.channelId = channels[0].channel_id;
      await reloadRows();
    } catch (err) {
      console.error("Failed to load UbiBot channels", err);
      ubiState.channelId = "";
      ubiState.rows = [];
      renderEmpty("Klarte ikke laste UbiBot-kanaler.");
    } finally {
      setLoading(false);
    }
  };

  ubSpan.addEventListener("change", () => {
    ubiState.span = asSpan(ubSpan.value);
    if (ubiState.span === "month") {
      ubiState.monthValue = asMonthValue(ubMonth.value);
      ubMonth.value = ubiState.monthValue;
    }
    syncBucketOptions(true);
    syncMonthField();
    void reloadRows();
  });

  ubMonth.addEventListener("change", () => {
    ubiState.monthValue = asMonthValue(ubMonth.value);
    ubMonth.value = ubiState.monthValue;
    if (ubiState.span === "month") {
      void reloadRows();
    }
  });

  ubBucket.addEventListener("change", () => {
    ubiState.bucket = asBucket(ubBucket.value);
    renderGraph();
  });

  ubRefresh.addEventListener("click", () => {
    void reloadRows();
  });

  await loadDefaultChannel();
}
