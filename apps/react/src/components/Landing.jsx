import { useMemo } from "react";
import { NI_CODE, councilPaths } from "@nisra-explorer/core";
import SearchBox from "./SearchBox.jsx";

export default function Landing({ geo, select }) {
  const { viewBox, paths } = useMemo(() => councilPaths(geo), [geo]);

  return (
    <div className="landing">
      <section className="card">
        <h2>Explore key statistics for any area in Northern Ireland</h2>
        <SearchBox geo={geo} onSelect={select} />
        <h2>Or select your council area</h2>
        <div className="link-list">
          {geo.lgds.map((area) => (
            <a key={area.code} href={`#/${area.code}`}>
              {area.name}
            </a>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Click on the map to view Northern Ireland as a whole</h2>
        <a className="ni-link" href={`#/${NI_CODE}`} aria-label="View Northern Ireland as a whole">
          <svg className="ni-svg" viewBox={viewBox} role="img" aria-hidden="true">
            {paths.map(({ area, d }) => (
              <path key={area.code} d={d} />
            ))}
          </svg>
        </a>
      </section>
    </div>
  );
}
