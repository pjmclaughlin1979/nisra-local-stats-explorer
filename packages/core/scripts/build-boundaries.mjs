// Fetches open (OGL) boundary polygons for Northern Ireland's 11 Local Government Districts and
// 80 District Electoral Areas, simplifies them server-side, attaches the official NISRA names (from
// the Data Portal, so they match the statistics tables exactly), each DEA's parent council, and the
// area in km², and writes them as static GeoJSON into packages/core/data/.
//
// Run with `npm run boundaries` from the repo root. Only needed when boundaries change.

import { writeFile } from "node:fs/promises";

const LGD_SERVICE =
  "https://services.arcgis.com/pMnvm7HXxTmNXxGi/arcgis/rest/services/LGD_NI_2012/FeatureServer/0";
const DEA_SERVICE =
  "https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/FarmCensusDistrictElectoralArea2019/FeatureServer/0";
const PXSTAT = "https://ws-data.nisra.gov.uk/public/api.restful/PxStat.Data.Cube_API.ReadDataset";

const OUT_DIR = new URL("../data/", import.meta.url);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function queryUrl(service, fields) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: fields,
    outSR: "4326",
    maxAllowableOffset: "0.0004",
    geometryPrecision: "5",
    f: "geojson",
  });
  return `${service}/query?${params}`;
}

async function geoLabels(matrix, dim) {
  const ds = await getJson(`${PXSTAT}/${matrix}/JSON-stat/2.0/en`);
  return ds.dimension[dim].category.label;
}

// Spherical polygon area (km²) of a GeoJSON ring in lon/lat degrees.
function ringAreaKm2(ring) {
  const R = 6371.0088;
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    total += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((total * R * R) / 2);
}

function areaKm2(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let area = 0;
  for (const rings of polygons) {
    rings.forEach((ring, i) => (area += i === 0 ? ringAreaKm2(ring) : -ringAreaKm2(ring)));
  }
  return Math.round(area * 100) / 100;
}

const [lgdRaw, deaRaw, lgdNames, deaNames] = await Promise.all([
  getJson(queryUrl(LGD_SERVICE, "LGDCode")),
  getJson(queryUrl(DEA_SERVICE, "DEACode")),
  geoLabels("MYE01T06", "LGD2014"),
  geoLabels("MYE01T010", "DEA2014"),
]);

const lgd = {
  type: "FeatureCollection",
  features: lgdRaw.features
    .map((f) => ({
      type: "Feature",
      properties: {
        code: f.properties.LGDCode,
        name: lgdNames[f.properties.LGDCode],
        areaKm2: areaKm2(f.geometry),
      },
      geometry: f.geometry,
    }))
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
};

// The DAERA layer leaves Titanic (Belfast's harbour DEA, which has no farms) without a code. Fill a
// single gap like that from whichever NISRA DEA code is otherwise unmatched.
const deaCodes = new Set(deaRaw.features.map((f) => f.properties.DEACode));
const unmatched = Object.keys(deaNames).filter((c) => c.startsWith("N10") && !deaCodes.has(c));
const uncoded = deaRaw.features.filter((f) => !f.properties.DEACode);
if (uncoded.length === 1 && unmatched.length === 1) uncoded[0].properties.DEACode = unmatched[0];

// DEA codes embed their council: N10000|01|01 → N09000001.
const dea = {
  type: "FeatureCollection",
  features: deaRaw.features
    .map((f) => {
      const code = f.properties.DEACode;
      return {
        type: "Feature",
        properties: {
          code,
          name: deaNames[code],
          parent: `N090000${code.slice(5, 7)}`,
          areaKm2: areaKm2(f.geometry),
        },
        geometry: f.geometry,
      };
    })
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
};

const missing = [...lgd.features, ...dea.features].filter((f) => !f.properties.name);
if (missing.length) throw new Error(`No NISRA name for ${missing.map((f) => f.properties.code)}`);

await writeFile(new URL("lgd.json", OUT_DIR), JSON.stringify(lgd));
await writeFile(new URL("dea.json", OUT_DIR), JSON.stringify(dea));
console.log(`Wrote ${lgd.features.length} LGDs and ${dea.features.length} DEAs`);
