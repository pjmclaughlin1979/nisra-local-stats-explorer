import { useEffect, useState } from "react";
import { fmt, runIndicator } from "@nisra-explorer/core";

export default function IndicatorCard({ indicator, area, compare, geo }) {
  const [state, setState] = useState({ status: "loading" });
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    runIndicator(indicator, { area, compare, geo }).then(
      (model) => alive && setState({ status: "ready", model }),
      (error) => alive && setState({ status: "error", error })
    );
    return () => {
      alive = false;
    };
  }, [indicator, area, compare, geo]);

  const model = state.model;

  return (
    <article className="card indicator">
      <header className="indicator__head">
        <h3>{indicator.title}</h3>
        <button
          className="info-toggle"
          aria-expanded={infoOpen}
          aria-label={`About ${indicator.title}`}
          onClick={() => setInfoOpen((o) => !o)}
        >
          i
        </button>
      </header>

      {infoOpen && (
        <div className="indicator__info">
          <p>{indicator.description}</p>
          {model?.tables?.length > 0 && (
            <ul>
              {model.tables.map((t) => (
                <li key={t.matrix}>
                  Access data at: <a href={t.url} target="_blank" rel="noreferrer">{t.label}</a>
                  {t.updated && ` (updated ${t.updated})`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.status === "loading" && <div className="skeleton" />}
      {state.status === "error" && <p className="error">Couldn't load this statistic: {state.error.message}</p>}
      {state.status === "ready" && <Body model={model} />}
    </article>
  );
}

function Body({ model }) {
  if (model.kind === "unavailable") return <p className="unavailable">{model.message}</p>;
  return (
    <>
      <p className="indicator__period">{model.period}</p>
      {model.kind === "headline" && <Headline model={model} />}
      {model.kind === "bars" && <Bars model={model} />}
      {model.kind === "figures" && <Figures model={model} />}
    </>
  );
}

function Headline({ model }) {
  return (
    <>
      <div>
        <span className="headline__value">{model.value}</span>
        {model.unit && <span className="headline__unit">{model.unit}</span>}
      </div>
      <ul className="headline__lines">
        {model.lines.map((line, i) => (
          <li key={i}>
            {line.text}
            {line.badge && <span className="badge">{line.badge}</span>}
            {line.after && ` ${line.after}`}
          </li>
        ))}
      </ul>
      {model.change && (
        <span className={`change change--${model.change.direction}`}>
          {model.change.direction === "up" ? "▲ Up" : "▼ Down"} {model.change.text}
        </span>
      )}
      {model.comparisons.map((c) => (
        <p className="comparisons" key={c.name}>
          Compared with <b>{c.name}</b>: {c.value}
        </p>
      ))}
    </>
  );
}

function Bars({ model }) {
  const max = Math.max(1, ...model.rows.flatMap((r) => r.values.filter((v) => v != null)));
  return (
    <>
      <div className="legend">
        {model.series.map((s) => (
          <span className="legend__item" key={s.code}>
            <span className={`swatch swatch--${s.role}`} />
            {s.name}
          </span>
        ))}
      </div>
      {model.rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-row__label">{row.label}</div>
          {row.values.map((v, i) => (
            <div className="bar" key={model.series[i].code} title={`${model.series[i].name}: ${fmt.percent(v)}`}>
              <div
                className={`bar__fill bar__fill--${model.series[i].role}`}
                style={{ width: `${((v ?? 0) / max) * 85}%` }}
              />
              <span className="bar__value">{fmt.barLabel(v)}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function Figures({ model }) {
  return (
    <dl className="figures">
      {model.items.map((item) => (
        <div className="figure" key={item.label}>
          <dt>{item.label}</dt>
          <dd className="figure__value">{item.value}</dd>
          {item.detail && <dd className="figure__detail">{item.detail}</dd>}
          {item.comparisons.length > 0 && (
            <dd className="figure__compare">
              {item.comparisons.map((c) => (
                <span key={c.name}>
                  {c.name} {c.value}
                </span>
              ))}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
