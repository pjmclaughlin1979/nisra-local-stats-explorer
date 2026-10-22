import { useState } from "react";
import { fmt, icons } from "@nisra-explorer/core";
import { useModel } from "../models.js";
import Source from "./Source.jsx";

export default function TopicSection({ category, area, geo, onShare }) {
  return (
    <section className="topic" id={`topic-${category.id}`}>
      <h2>
        <span className="topic__icon" dangerouslySetInnerHTML={{ __html: icons[category.icon] }} />
        {category.title}
      </h2>
      {category.id === "people" && (
        <>
          <IndicatorBlock id="population" title="Population" area={area} geo={geo} onShare={onShare} topic={category.id} />
          <IndicatorBlock id="density" title="Population density" area={area} geo={geo} onShare={onShare} topic={category.id} />
        </>
      )}
      {category.indicators.map((indicator) => (
        <IndicatorBlock
          key={indicator.id}
          id={indicator.id}
          title={indicator.title}
          area={area}
          geo={geo}
          onShare={onShare}
          topic={category.id}
        />
      ))}
    </section>
  );
}

function IndicatorBlock({ id, title, area, geo, onShare, topic }) {
  const state = useModel(id, area, geo);
  const model = state.model;

  return (
    <div className="block">
      <h3>{title}</h3>
      {state.status === "loading" && <div className="shimmer shimmer--block" />}
      {state.status === "error" && <p className="error">Couldn't load this statistic: {state.error.message}</p>}
      {state.status === "ready" && model.kind === "unavailable" && <p className="is-muted">{model.message}</p>}
      {state.status === "ready" && model.kind === "headline" && <HeadlineCallout model={model} area={area} title={title} />}
      {state.status === "ready" && model.kind === "figures" && <FigureCallouts model={model} area={area} />}
      {state.status === "ready" && model.kind === "bars" && (
        <BarChart model={model} area={area} title={title} onShare={() => onShare({ topic })} />
      )}
      {state.status === "ready" && model.kind !== "unavailable" && <Source tables={model.tables} period={model.period} />}
    </div>
  );
}

function HeadlineCallout({ model, area, title }) {
  return (
    <div className="callouts">
      <div className="callout">
        <div className="callout__value">
          {model.value}
          {model.unit && <span className="callout__unit"> {model.unit}</span>}
        </div>
        <div className="callout__label">
          {title} in {area.name}
        </div>
        {model.lines.map((line, i) => (
          <div className="callout__note" key={i}>
            {[line.text, line.badge, line.after].filter(Boolean).join(" ")}
          </div>
        ))}
        {model.change && (
          <div className={`callout__change callout__change--${model.change.direction}`}>
            {model.change.direction === "up" ? "▲" : "▼"} {model.change.text}
          </div>
        )}
      </div>
    </div>
  );
}

function FigureCallouts({ model, area }) {
  return (
    <div className="callouts">
      {model.items.map((item) => {
        const ni = item.comparisons.find((c) => c.name === "NI");
        return (
          <div className="callout-pair" key={item.label}>
            <div className="callout">
              <div className="callout__value">{item.value}</div>
              <div className="callout__label">
                {item.label} in {area.name}
              </div>
              {item.detail && <div className="callout__note">{item.detail}</div>}
            </div>
            {ni && (
              <div className="callout callout--ni">
                <div className="callout__value">{ni.value}</div>
                <div className="callout__label">{item.label} in Northern Ireland</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BarChart({ model, area, title, onShare }) {
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...model.rows.flatMap((r) => r.values.filter((v) => v != null)));

  return (
    <figure className="chart">
      <figcaption className="chart__head">
        <div>
          <strong>{title}</strong>
          <span className="chart__sub">in {area.name}</span>
        </div>
        <button className="btn-outline btn-outline--small" onClick={onShare}>
          Share / Embed
        </button>
      </figcaption>

      {asTable ? (
        <table className="chart__table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              {model.series.map((s) => (
                <th scope="col" key={s.code}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((v, i) => (
                  <td key={model.series[i].code}>{fmt.percent(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="chart__legend">
            {model.series.map((s) => (
              <span key={s.code}>
                <i className={`swatch swatch--${s.role}`} />
                {s.name}
              </span>
            ))}
          </div>
          <div className="chart__rows">
            {model.rows.map((row) => (
              <div className="chart__row" key={row.label}>
                <div className="chart__label">{row.label}</div>
                <div className="chart__bars">
                  {row.values.map((v, i) => (
                    <div className="chart__bar" key={model.series[i].code} title={`${model.series[i].name}: ${fmt.percent(v)}`}>
                      <span className={`chart__fill chart__fill--${model.series[i].role}`} style={{ width: `${((v ?? 0) / max) * 100}%` }} />
                      <span className="chart__value">{fmt.percent(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <label className="toggle toggle--small">
        <input type="checkbox" checked={asTable} onChange={(e) => setAsTable(e.target.checked)} />
        <span className="toggle__track" aria-hidden="true" />
        Show Table
      </label>
    </figure>
  );
}
