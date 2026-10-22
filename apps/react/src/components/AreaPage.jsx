import { Fragment, useState } from "react";
import { LEVELS, ancestors, categories, describeArea, headlines } from "@nisra-explorer/core";
import SearchBox from "./SearchBox.jsx";
import IndicatorCard from "./IndicatorCard.jsx";
import MapSection from "./MapSection.jsx";
import ThemeSection from "./ThemeSection.jsx";

export default function AreaPage({ geo, area, compare, select }) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Which themes are expanded; kept while moving between areas.
  const [openThemes, setOpenThemes] = useState(() => new Set());

  function toggleTheme(id) {
    setOpenThemes((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
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

      <div className="themes">
        {categories.map((category) => (
          <ThemeSection
            key={category.id}
            category={category}
            open={openThemes.has(category.id)}
            onToggle={() => toggleTheme(category.id)}
            area={area}
            compare={compare}
            geo={geo}
          />
        ))}
      </div>
    </>
  );
}
