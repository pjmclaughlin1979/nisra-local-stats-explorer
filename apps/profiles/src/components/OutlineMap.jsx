import { useMemo } from "react";
import { heroOutline } from "../outline.js";

/** Static outline of an area in its surroundings (no map library needed). */
export default function OutlineMap({ area, geo, className }) {
  const outline = useMemo(() => heroOutline(area, geo), [area, geo]);
  return (
    <svg className={`outline-map ${className ?? ""}`} viewBox={outline.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path className="outline-map__context" d={outline.context} />
      <path className="outline-map__focus" d={outline.focus} />
    </svg>
  );
}
