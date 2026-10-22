// Framework-free controller for the explorer's map. Both apps render an <arcgis-map> element
// (ArcGIS Maps SDK for JavaScript 5.x map component) and hand it to `createExplorerMap`, which
// owns the layers, selection drawing, hover and click behaviour.

import Map from "@arcgis/core/Map.js";
import Basemap from "@arcgis/core/Basemap.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import { boundaryUrls } from "./geography.js";

const NAVY = [0, 32, 91];
const PURPLE = [115, 39, 119];
const GREEN = [15, 130, 67];

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

const labelClass = (size) => ({
  labelExpressionInfo: { expression: "$feature.name" },
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

const controllers = new WeakMap();

/**
 * Sets up the explorer on an <arcgis-map> element. Calling it again for the same element returns
 * the same controller, so a framework re-running its mount effect (React StrictMode) doesn't
 * rebuild the map mid-animation. The element destroys its own view when it leaves the DOM.
 *
 * @param {HTMLElement} mapEl  an <arcgis-map> element
 * @param {{ onSelect: (code: string) => void }} options
 * @returns {Promise<{ show: ({ area, compare }) => Promise<void>, destroy: () => void }>}
 */
export function createExplorerMap(mapEl, options) {
  if (!controllers.has(mapEl)) controllers.set(mapEl, setUp(mapEl, options));
  return controllers.get(mapEl);
}

async function setUp(mapEl, { onSelect }) {
  const lgdLayer = new GeoJSONLayer({
    url: boundaryUrls.lgd,
    title: "Councils",
    outFields: ["*"],
    renderer: outlineRenderer(0.12, 1.2),
    labelingInfo: [labelClass(10)],
  });
  const deaLayer = new GeoJSONLayer({
    url: boundaryUrls.dea,
    title: "District Electoral Areas",
    outFields: ["*"],
    visible: false,
    renderer: outlineRenderer(0.06, 0.8),
    labelingInfo: [labelClass(9)],
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

  await mapEl.viewOnReady();
  const view = mapEl.view;
  await Promise.all([lgdLayer.load(), deaLayer.load()]);
  const niExtent = lgdLayer.fullExtent;

  let current = null;
  let hoverGraphic = null;
  const handles = [];

  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip";
  tooltip.hidden = true;
  mapEl.append(tooltip);

  async function featureFor(code) {
    for (const layer of [deaLayer, lgdLayer]) {
      const { features } = await layer.queryFeatures({
        where: `code = '${code}'`,
        returnGeometry: true,
        outSpatialReference: view.spatialReference,
        outFields: ["*"],
      });
      if (features.length) return features[0];
    }
    return null;
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
      const code = graphic?.attributes.code;
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
        if (hoverGraphic) overlay.remove(hoverGraphic);
        hoverGraphic = null;
        if (graphic) {
          hoverGraphic = new Graphic({
            geometry: graphic.geometry,
            symbol: ringSymbol(PURPLE, 2, "solid", 0.08),
          });
          overlay.add(hoverGraphic);
          tooltip.textContent = graphic.attributes.name;
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
    deaLayer.definitionExpression = council ? `parent = '${council.code}'` : null;
    lgdLayer.labelsVisible = !council;

    const [selected, compared] = await Promise.all([
      area.level === "ni" ? null : featureFor(area.code),
      compare ? featureFor(compare.code) : null,
    ]);
    if (current?.area !== area) return; // a newer selection arrived while querying

    if (compared) {
      overlay.add(new Graphic({ geometry: compared.geometry, symbol: ringSymbol(GREEN, 2.5, "dash", 0.12) }));
    }
    if (selected) {
      overlay.add(new Graphic({ geometry: selected.geometry, symbol: ringSymbol(PURPLE, 3.5) }));
    }

    const target = selected?.geometry.extent.clone().expand(area.level === "dea" ? 1.8 : 1.15) ?? niExtent;
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
