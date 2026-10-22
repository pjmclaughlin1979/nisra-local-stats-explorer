import { useEffect, useRef, useState } from "react";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import { LEVELS, ancestors } from "@nisra-explorer/core";
import { createExplorerMap } from "@nisra-explorer/core/map";

// Everything chosen from the map section keeps the page scrolled to the map, so the zoom is visible.
const STAY = { keepScroll: true };

export default function MapSection({ geo, area, compare, select }) {
  const mapRef = useRef(null);
  const controllerRef = useRef(null);
  const selectRef = useRef(select);
  const [ready, setReady] = useState(false);
  selectRef.current = select;

  // One controller per <arcgis-map> element; the element tears down its own view on unmount.
  useEffect(() => {
    let cancelled = false;
    createExplorerMap(mapRef.current, { onSelect: (code) => selectRef.current(code, undefined, STAY) }).then((controller) => {
      if (cancelled) return;
      controllerRef.current = controller;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) controllerRef.current?.show({ area, compare });
  }, [ready, area, compare]);

  const stay = (code) => (event) => {
    event.preventDefault();
    select(code, undefined, STAY);
  };

  const larger = ancestors(area);
  const childLevel = area.level === "ni" ? "lgd" : area.level === "lgd" ? "dea" : null;
  const peers = area.level === "ni" ? [] : geo.atLevel(area.level).filter((a) => a !== area);

  return (
    <section className="map-section">
      <h2>
        You are currently viewing <span>{area.name}</span>
        {area.level !== "ni" && ` ${LEVELS[area.level].label.toLowerCase()}`}
      </h2>
      <p className="hint">Zoom and click on the map to explore other areas</p>
      <div className="map-layout">
        <div className="map-frame">
          <arcgis-map ref={mapRef}>
            <arcgis-zoom slot="top-left" />
          </arcgis-map>
        </div>
        <aside className="map-side">
          {larger.length > 0 && (
            <section>
              <h3>Select a larger area containing {area.name}</h3>
              <div className="link-list">
                {larger.map((a) => (
                  <a key={a.code} href={`#/${a.code}`} onClick={stay(a.code)}>
                    {a.name}
                  </a>
                ))}
              </div>
            </section>
          )}
          {childLevel && (
            <section>
              <h3>
                Select {childLevel === "lgd" ? "a council" : "an electoral area"} within {area.name}
              </h3>
              <div className="link-list">
                {area.children.map((a) => (
                  <a key={a.code} href={`#/${a.code}`} onClick={stay(a.code)}>
                    {a.name}
                  </a>
                ))}
              </div>
            </section>
          )}
          {area.level === "dea" && (
            <section>
              <h3>Other electoral areas in {area.parent.name}</h3>
              <div className="link-list">
                {area.parent.children
                  .filter((a) => a !== area)
                  .map((a) => (
                    <a key={a.code} href={`#/${a.code}`} onClick={stay(a.code)}>
                      {a.name}
                    </a>
                  ))}
              </div>
            </section>
          )}
          {peers.length > 0 && (
            <section>
              <h3>Compare with another {LEVELS[area.level].singular}</h3>
              <select
                aria-label={`Compare with another ${LEVELS[area.level].singular}`}
                value={compare?.code ?? ""}
                onChange={(e) => select(area.code, e.target.value || null, STAY)}
              >
                <option value="">Choose an area…</option>
                {area.level === "dea"
                  ? geo.lgds.map((lgd) => (
                      <optgroup key={lgd.code} label={lgd.name}>
                        {lgd.children
                          .filter((a) => a !== area)
                          .map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.name}
                            </option>
                          ))}
                      </optgroup>
                    ))
                  : peers.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.name}
                      </option>
                    ))}
              </select>
              {compare && (
                <>
                  <div>
                    <span className="compare-key">
                      <span className="swatch swatch--area" /> {area.name}
                    </span>
                    <span className="compare-key">
                      <span className="swatch swatch--compare" /> {compare.name}
                    </span>
                  </div>
                  <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => select(area.code, null, STAY)}>
                    Clear comparison
                  </button>
                </>
              )}
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}
