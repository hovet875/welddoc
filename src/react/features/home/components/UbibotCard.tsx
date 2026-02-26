import { useMemo } from "react";
import { asMonthValue, buildUbibotChartModel } from "../lib/ubibotChart";
import { useUbibotData } from "../hooks/useUbibotData";
import { UbibotChart } from "./UbibotChart";

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
    <div className="herocard">
      <div className="ub-head">
        <span className="ub-title">Klimalogging sveisetilsett</span>
        <button
          type="button"
          className={`btn small ub-refresh-btn${loadingRows ? " is-loading" : ""}`}
          aria-label="Oppdater"
          onClick={refresh}
          disabled={loading}
        >
          <span className="ub-refresh-wheel" aria-hidden="true">
            ↻
          </span>
        </button>
      </div>

      <div className={`ub-controls${showMonth ? " has-month" : ""}`}>
        <label className="ub-field">
          <span>Periode</span>
          <select className="select" value={span} disabled={loading} onChange={(event) => setSpanValue(event.target.value)}>
            <option value="7d">7 dager</option>
            <option value="30d">30 dager</option>
            <option value="90d">90 dager</option>
            <option value="12m">12 måneder</option>
            <option value="month">Valgt måned</option>
          </select>
        </label>

        <label className="ub-field ub-month-field" hidden={!showMonth}>
          <span>Måned</span>
          <input
            className="input"
            type="month"
            value={asMonthValue(monthValue)}
            disabled={loading || !showMonth}
            onChange={(event) => setMonthValue(event.target.value)}
          />
        </label>

        <label className="ub-field">
          <span>Visning</span>
          <select className="select" value={bucket} disabled={loading} onChange={(event) => setBucketValue(event.target.value)}>
            {bucketOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ub-chart">
        <UbibotChart model={chartModel} />
      </div>
      <div className="ub-foot muted">{chartModel.lastUpdatedText}</div>
    </div>
  );
}
