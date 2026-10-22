// Framework-free controller for the explorer's map. Both apps render an <arcgis-map> element
// (ArcGIS Maps SDK for JavaScript 5.x map component) and hand it to `createExplorerMap`, which
// owns the layers, selection drawing, hover and click behaviour.
//
// Both boundary layers are official feature services: District Electoral Areas from DAERA, and
// councils from the ONS UK Local Authority Districts layer filtered to Northern Ireland.

import Map from "@arcgis/core/Map.js";
import Basemap from "@arcgis/core/Basemap.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import { DEA_SERVICE_URL } from "./geography.js";

/**
 * ONS Local Authority Districts (May 2026), UK, generalised and clipped to the coastline (BGC).
 * Marked authoritative on ArcGIS Online; its N09 codes are the same council codes NISRA uses.
 */
const COUNCIL_SERVICE_URL =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_May_2026_Boundaries_UK_BGC/FeatureServer/0";
const NI_COUNCILS = "LAD26CD LIKE 'N09%'";

const NAVY = [0, 32, 91];
const PURPLE = [115, 39, 119];
const GREEN = [15, 130, 67];
const WGS84 = { wkid: 4326 };

// Esri's public light grey canvas tiles need no API key, unlike the basemap styles service.
const CANVAS = "https://services.arcgisonline.com/arcgis/rest/services/Canvas";

const outlineRenderer = (fillAlpha, width) => ({
  type: "simple",
  symbol: {
    type: "simple-fill",
    color: [...NAVY, fillAlpha],
    outline: { color: [...NAVY, 0.9], width },
  },
});

const labelClass = (size, expression) => ({
  labelExpressionInfo: { expression },
  symbol: {
    type: "text",
    color: [...NAVY, 1],
    haloColor: [255, 255, 255, 0.9],
    haloSize: 1.5,
    font: { family: "Arial", size, weight: "bold" },
  },
});

const ringSymbol = (color, width, style = "solid", fillAlpha = 0.18) => ({
  type: "simple-fill",
  color: [...color, fillAlpha],
  outline: { color: [...color, 1], width, style },
});

/**
 * Arcade label for the DAERA layer: its own names are upper case and Titanic has none, so labels
 * use the official NISRA names keyed by code.
 */
function deaLabelExpression(geo) {
  const pairs = geo.deas.map((d) => `${JSON.stringify(d.code)}, ${JSON.stringify(d.name)}`).join(", ");
  const fallback = JSON.stringify(geo.uncodedDea ?? "");
  return `var code = DefaultValue($feature.DEACode, ${fallback}); return Decode(code, ${pairs}, "");`;
}

const controllers = new WeakMap();

/**
 * Sets up the explorer on an <arcgis-map> element. Calling it again for the same element returns
 * the same controller, so a framework re-running its mount effect (React StrictMode) doesn't
 * rebuild the map mid-animation. The element destroys its own view when it leaves the DOM.
 *
 * @param {HTMLElement} mapEl  an <arcgis-map> element
 * @param {{ geo: object, onSelect: (code: string) => void }} options
 * @returns {Promise<{ show: ({ area, compare }) => Promise<void>, destroy: () => void }>}
 */
export function createExplorerMap(mapEl, options) {
  if (!controllers.has(mapEl)) controllers.set(mapEl, setUp(mapEl, options));
  return controllers.get(mapEl);
}

async function setUp(mapEl, { geo, onSelect }) {
  const lgdLayer = new FeatureLayer({
    url: COUNCIL_SERVICE_URL,
    title: "Councils (ONS)",
    definitionExpression: NI_COUNCILS,
    outFields: ["LAD26CD", "LAD26NM"],
    renderer: outlineRenderer(0.12, 1.2),
    labelingInfo: [labelClass(10, "$feature.LAD26NM")],
  });
  const deaLayer = new FeatureLayer({
    url: DEA_SERVICE_URL,
    title: "District Electoral Areas (DAERA)",
    outFields: ["DEACode"],
    visible: false,
    renderer: outlineRenderer(0.06, 0.8),
    labelingInfo: [labelClass(9, deaLabelExpression(geo))],
  });
  const overlay = new GraphicsLayer({ title: "Selection" });

  mapEl.map = new Map({
    basemap: new Basemap({
      baseLayers: [new TileLayer({ url: `${CANVAS}/World_Light_Gray_Base/MapServer` })],
      referenceLayers: [new TileLayer({ url: `${CANVAS}/World_Light_Gray_Reference/MapServer` })],
    }),
    layers: [lgdLayer, deaLayer, overlay],
  });
  // An explicit starting viewpoint stops the view fitting itself to the layers once they load,
  // which would otherwise override the first goTo().
  mapEl.center = [-6.7, 54.62];
  mapEl.zoom = 8;
  mapEl.popupDisabled = true;
  mapEl.constraints = { minZoom: 6, snapToZoom: false };

  // Council outlines are fetched once (11 features) for drawing selections, hover and zooming.
  const [, { features: councils }] = await Promise.all([
    mapEl.viewOnReady(),
    lgdLayer.queryFeatures({
      where: NI_COUNCILS,
      outFields: ["LAD26CD"],
      returnGeometry: true,
      outSpatialReference: WGS84,
    }),
  ]);
  const view = mapEl.view;
  const councilShapes = new globalThis.Map(councils.map((f) => [f.attributes.LAD26CD, f.geometry]));
  // Extent.union() modifies its target, so accumulate into a copy.
  const niExtent = councils.reduce((all, f) => all.union(f.geometry.extent), councils[0].geometry.extent.clone());

  let current = null;
  let hoverGraphic = null;
  const handles = [];

  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip";
  tooltip.hidden = true;
  mapEl.append(tooltip);

  /** Area code of a hit graphic from either layer (DAERA's Titanic feature has no code). */
  const codeOf = (graphic) =>
    graphic.layer === deaLayer ? (graphic.attributes.DEACode ?? geo.uncodedDea) : graphic.attributes.LAD26CD;

  /** Outline of an area, built from the geography already loaded — no extra request. */
  function shapeOf(area) {
    if (area.level === "lgd") return councilShapes.get(area.code);
    return new Polygon({ rings: area.rings, spatialReference: WGS84 });
  }

  /** DAERA has no council field, but DEA codes embed their council's number. */
  function deasIn(council) {
    const clause = `DEACode LIKE 'N1000${council.code.slice(-2)}%'`;
    const uncoded = geo.get(geo.uncodedDea);
    return uncoded?.parent === council ? `${clause} OR DEACode IS NULL` : clause;
  }

  async function hit(event) {
    const include = deaLayer.visible ? [deaLayer, lgdLayer] : [lgdLayer];
    const { results } = await view.hitTest(event, { include });
    const graphics = results.filter((r) => r.type === "graphic").map((r) => r.graphic);
    // DEAs sit on top of their council, so prefer them when both are hit.
    return graphics.find((g) => g.layer === deaLayer) ?? graphics.find((g) => g.layer === lgdLayer) ?? null;
  }

  handles.push(
    view.on("click", async (event) => {
      const graphic = await hit(event);
      const code = graphic && codeOf(graphic);
      if (code && code !== current?.area.code) onSelect(code);
    })
  );

  let pending = false;
  handles.push(
    view.on("pointer-move", async (event) => {
      if (pending) return;
      pending = true;
      try {
        const graphic = await hit(event);
        const area = graphic && geo.get(codeOf(graphic));
        if (hoverGraphic) overlay.remove(hoverGraphic);
        hoverGraphic = null;
        if (area) {
          hoverGraphic = new Graphic({ geometry: shapeOf(area), symbol: ringSymbol(PURPLE, 2, "solid", 0.08) });
          overlay.add(hoverGraphic);
          tooltip.textContent = area.name;
          tooltip.style.transform = `translate(${event.x + 14}px, ${event.y + 14}px)`;
          tooltip.hidden = false;
          mapEl.style.cursor = "pointer";
        } else {
          tooltip.hidden = true;
          mapEl.style.cursor = "";
        }
      } finally {
        pending = false;
      }
    })
  );
  handles.push(
    view.on("pointer-leave", () => {
      tooltip.hidden = true;
      if (hoverGraphic) overlay.remove(hoverGraphic);
      hoverGraphic = null;
    })
  );

  async function show({ area, compare }) {
    current = { area, compare };
    overlay.removeAll();
    hoverGraphic = null;

    const council = area.level === "dea" ? area.parent : area.level === "lgd" ? area : null;
    deaLayer.visible = Boolean(council);
    deaLayer.definitionExpression = council ? deasIn(council) : "1=0";
    lgdLayer.labelsVisible = !council;

    const selected = area.level === "ni" ? null : shapeOf(area);
    if (compare) {
      overlay.add(new Graphic({ geometry: shapeOf(compare), symbol: ringSymbol(GREEN, 2.5, "dash", 0.12) }));
    }
    if (selected) {
      overlay.add(new Graphic({ geometry: selected, symbol: ringSymbol(PURPLE, 3.5) }));
    }

    const target = selected?.extent.clone().expand(area.level === "dea" ? 1.8 : 1.15) ?? niExtent;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await view.goTo(target, { animate: !reduceMotion, duration: 1400, easing: "in-out-cubic" }).catch((error) => {
      // goTo is interrupted whenever a newer selection or user interaction takes over.
      if (error.name !== "AbortError") console.warn("Map navigation failed", error);
    });
  }

  return {
    show,
    destroy() {
      handles.forEach((h) => h.remove());
      tooltip.remove();
      controllers.delete(mapEl);
    },
  };
}
