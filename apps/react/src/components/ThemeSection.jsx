import { useEffect, useState } from "react";
import { NI_CODE, icons } from "@nisra-explorer/core";
import IndicatorCard from "./IndicatorCard.jsx";

const Chevron = () => (
  <svg className="theme__chevron" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** One collapsible theme. Its statistics are only fetched the first time it is opened. */
export default function ThemeSection({ category, open, onToggle, area, compare, geo }) {
  const [visited, setVisited] = useState(open);
  const [moreOpen, setMoreOpen] = useState(false);
  const panelId = `theme-${category.id}`;
  const cardKey = `${area.code}:${compare?.code ?? ""}`;

  useEffect(() => {
    if (open) setVisited(true);
  }, [open]);

  return (
    <section className="theme">
      <h2 className="theme__heading">
        <button className="theme__toggle" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
          <span className="theme__icon" dangerouslySetInnerHTML={{ __html: icons[category.icon] }} />
          {category.title}
          <Chevron />
        </button>
      </h2>
      <div className="theme__panel" id={panelId} data-open={open ? "" : undefined} inert={!open}>
        <div className="theme__clip">
          {visited && (
            <div className="theme__body">
              <p className="theme__intro">
                {category.title} statistics for {area.name}
                {area.code !== NI_CODE && (
                  <>
                    {" "}
                    compared with <a href={`#/${NI_CODE}`}>Northern Ireland</a>
                  </>
                )}
                {compare && ` and ${compare.name}`}.
              </p>
              <div className="indicator-grid">
                {category.indicators.map((indicator) => (
                  <IndicatorCard
                    key={`${indicator.id}:${cardKey}`}
                    indicator={indicator}
                    area={area}
                    compare={compare}
                    geo={geo}
                  />
                ))}
              </div>
              <div className="more">
                <h3>
                  More {category.title.toLowerCase()} statistics
                  <button className="more__toggle" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
                    {moreOpen ? "− Click to hide" : "+ Click to expand"}
                  </button>
                </h3>
                {moreOpen && (
                  <div className="more__body">
                    <p>{category.more.summary}</p>
                    <ul>
                      {category.more.links.map((link) => (
                        <li key={link.url}>
                          <a href={link.url} target="_blank" rel="noreferrer">
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
