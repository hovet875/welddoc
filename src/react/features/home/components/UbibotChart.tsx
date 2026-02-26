import type { UbibotChartModel } from "../types";

type UbibotChartProps = {
  model: UbibotChartModel;
};

export function UbibotChart({ model }: UbibotChartProps) {
  switch (model.kind) {
    case "error":
      return <div className="err">{model.message}</div>;
    case "loading":
    case "empty":
      return <div className="muted">{model.message}</div>;
    case "data":
      return (
        <>
          <div className="ub-nowtemp">
            Gjennomsnittlig målt luftfuktighet <strong>{model.avgRhLabel}</strong>
          </div>

          <svg
            viewBox={`0 0 ${model.viewW} ${model.viewH}`}
            role="img"
            aria-label="Temperatur og luftfuktighet fra UbiBot"
          >
            <g className="ub-grid">
              {model.yGrid.map((row, index) => (
                <g key={index}>
                  <line x1={model.padL} y1={row.y.toFixed(2)} x2={model.viewW - model.padR} y2={row.y.toFixed(2)} />
                  <text
                    className="ub-axis-label ub-axis-label-left"
                    x={model.padL - 10}
                    y={(row.y + 4).toFixed(2)}
                    textAnchor="end"
                  >
                    {row.tempLabel}
                  </text>
                  <text
                    className="ub-axis-label ub-axis-label-right"
                    x={model.viewW - model.padR + 10}
                    y={(row.y + 4).toFixed(2)}
                    textAnchor="start"
                  >
                    {row.rhLabel}
                  </text>
                </g>
              ))}
            </g>

            <g className="ub-axis">
              {model.xTicks.map((tick, index) => (
                <text
                  key={index}
                  className="ub-x-label"
                  x={tick.x.toFixed(2)}
                  y={model.viewH - 12}
                  textAnchor="middle"
                >
                  {tick.label}
                </text>
              ))}
            </g>

            {model.rhPath ? <path className="ub-rh-line" d={model.rhPath} /> : null}
            {model.tempPath ? <path className="ub-temp-line" d={model.tempPath} /> : null}
            {model.tempMarker ? (
              <circle
                className="ub-point ub-point-temp"
                cx={model.tempMarker.x.toFixed(2)}
                cy={model.tempMarker.y.toFixed(2)}
                r="3.8"
              />
            ) : null}
            {model.rhMarker ? (
              <circle
                className="ub-point ub-point-rh"
                cx={model.rhMarker.x.toFixed(2)}
                cy={model.rhMarker.y.toFixed(2)}
                r="3.8"
              />
            ) : null}
          </svg>

          <div className="ub-legend ub-legend-block">
            <span className="ub-legend-item">
              <span className="ub-legend-swatch ub-legend-temp"></span>
              Temperatur | min {model.tempMinLabel}°C / maks {model.tempMaxLabel}°C
            </span>
            <span className="ub-legend-item">
              <span className="ub-legend-swatch ub-legend-rh"></span>
              Luftfuktighet | min {model.rhMinLabel}% / maks {model.rhMaxLabel}%
            </span>
          </div>

          {model.note ? <div className="ub-note muted">{model.note}</div> : null}
        </>
      );
  }
}
