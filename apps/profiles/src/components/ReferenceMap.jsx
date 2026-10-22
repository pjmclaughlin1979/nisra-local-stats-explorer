import { useEffect, useRef, useState } from "react";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import { createExplorerMap } from "@nisra-explorer/core/map";
import { go, profileHref } from "../router.js";

/** The shared core's ArcGIS map: clicking a council or DEA opens its profile. */
export default function ReferenceMap({ area, geo }) {
  const mapRef = useRef(null);
  const controllerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createExplorerMap(mapRef.current, { geo, onSelect: (code) => go(profileHref(code)) }).then((controller) => {
      if (cancelled) return;
      controllerRef.current = controller;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [geo]);

  useEffect(() => {
    if (ready) controllerRef.current.show({ area, compare: null });
  }, [ready, area]);

  return (
    <div className="refmap">
      <arcgis-map ref={mapRef}>
        <arcgis-zoom slot="top-right" />
      </arcgis-map>
    </div>
  );
}
