import { Fragment, useState } from "react";
import { LEVELS, NI_CODE, ancestors, categories, describeArea, headlines, icons } from "@nisra-explorer/core";
import SearchBox from "./SearchBox.jsx";
import IndicatorCard from "./IndicatorCard.jsx";
import MapSection from "./MapSection.jsx";

export default function AreaPage({ geo, area, compare, select }) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Remount every card when the area or comparison changes so each reloads cleanly.
  const key = `${area.code}:${compare?.code ?? ""}`;

  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", location.href);
    }
  }

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="#/">Home</a>
        {ancestors(area).map((a) => (
          <Fragment key={a.code}>
            <span aria-hidden="true">›</span>
            <a href={`#/${a.code}`}>{a.name}</a>
          </Fragment>
        ))}
      </nav>

      <div className="area-header">
        <h1>
          {area.name}
          <span className="area-header__level">{LEVELS[area.level].name}</span>
        </h1>
        <div className="area-header__tools">
          <SearchBox geo={geo} onSelect={select} />
          <div className="btn-row">
            <button className="btn" aria-expanded={aboutOpen} onClick={() => setAboutOpen((o) => !o)}>
              About
            </button>
            <button className="btn" onClick={() => window.print()}>
              Print / PDF
            </button>
            <button className="btn" onClick={share}>
              Share
            </button>
          </div>
          {copied && <span className="toast" role="status">Link copied to clipboard</span>}
        </div>
      </div>

      {aboutOpen && (
        <div className="card about-panel">
          <p>
            The Local Statistics Explorer brings together key statistics for Northern Ireland, its 11
            councils and 80 District Electoral Areas. Every figure is read live from the NISRA Data
            Portal; use the <b>i</b> button on any card for its definition and source table.
          </p>
          <p>
            Search by area name or BT postcode, click the map to move between areas, or pick another
            area of the same type to compare against.
          </p>
        </div>
      )}

      <div className="headline-grid">
        <div className="card about-card">
          <h2>About {area.name}</h2>
          <p>{describeArea(area, geo)}</p>
        </div>
        {headlines.map((indicator) => (
          <IndicatorCard key={`${indicator.id}:${key}`} indicator={indicator} area={area} compare={compare} geo={geo} />
        ))}
      </div>

      <MapSection geo={geo} area={area} compare={compare} select={select} />

      {categories.map((category) => (
        <details className="topic" open key={category.id}>
          <summary>
            <span className="topic__icon" dangerouslySetInnerHTML={{ __html: icons[category.icon] }} />
            {category.title}
          </summary>
          <p className="topic__intro">
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
              <IndicatorCard key={`${indicator.id}:${key}`} indicator={indicator} area={area} compare={compare} geo={geo} />
            ))}
          </div>
        </details>
      ))}
    </>
  );
}
