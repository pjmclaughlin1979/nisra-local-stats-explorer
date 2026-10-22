// Northern Ireland's statistical geography hierarchy as used by the explorer:
// Northern Ireland → 11 Local Government Districts (councils) → 80 District Electoral Areas.

import { loadCube } from "./pxstat.js";

export const NI_CODE = "N92000002";

export const LEVELS = {
  ni: { name: "Northern Ireland", label: "Country", singular: "country", plural: "countries" },
  lgd: { name: "Local Government District", label: "Council", singular: "council", plural: "councils" },
  dea: { name: "District Electoral Area", label: "Electoral area", singular: "electoral area", plural: "electoral areas" },
};

/**
 * DAERA's public District Electoral Area layer (OSNI 2012 DEA boundaries, published with the Farm
 * Census). OSNI's own boundary services aren't reachable from a public web page — the open data
 * server is offline and its ArcGIS proxies only accept OSNI's own apps — so this is the official
 * source for all boundaries: councils are built from the DEAs that make them up.
 */
export const DEA_SERVICE_URL =
  "https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/FarmCensusDistrictElectoralArea2019/FeatureServer/0";

/** A council's code is embedded in each of its DEA codes: N10000|01|01 → N09000001. */
export const councilOf = (deaCode) => `N090000${deaCode.slice(5, 7)}`;

let geographyPromise;

/**
 * Loads the DEA boundaries from DAERA and the official area names from the NISRA Data Portal (the
 * same population tables the population cards use), and builds the area lookup.
 */
export function loadGeography() {
  geographyPromise ??= Promise.all([fetchDeaFeatures(), loadCube("MYE01T06"), loadCube("MYE01T010")]).then(
    ([features, lgdCube, deaCube]) =>
      buildGeography(features, lgdCube.dims.LGD2014.labels, deaCube.dims.DEA2014.labels)
  );
  // Let a later render retry after a network failure.
  geographyPromise.catch(() => (geographyPromise = null));
  return geographyPromise;
}

async function fetchDeaFeatures() {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "DEACode,Shape__Area",
    outSR: "4326",
    // Generalised to ~25m server-side: ~0.5 MB instead of ~14 MB at full detail.
    maxAllowableOffset: "0.0003",
    geometryPrecision: "5",
    f: "json",
  });
  const res = await fetch(`${DEA_SERVICE_URL}/query?${params}`);
  if (!res.ok) throw new Error(`DAERA boundary service returned ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`DAERA boundary service: ${json.error.message}`);
  return json.features;
}

/**
 * @param features    DAERA DEA features (Esri JSON, WGS84)
 * @param lgdNames    council code → official name
 * @param deaNames    DEA code → official name
 */
export function buildGeography(features, lgdNames, deaNames) {
  // DAERA's layer leaves Titanic (Belfast's harbour DEA, which has no farms) without a code. Fill a
  // single gap like that from whichever NISRA DEA code is otherwise unmatched, and remember it so
  // the map can recognise the uncoded feature.
  const coded = new Set(features.map((f) => f.attributes.DEACode).filter(Boolean));
  const unmatched = Object.keys(deaNames).filter((c) => c.startsWith("N10") && !coded.has(c));
  const uncoded = features.filter((f) => !f.attributes.DEACode);
  const uncodedDea = uncoded.length === 1 && unmatched.length === 1 ? unmatched[0] : null;

  const ni = { code: NI_CODE, name: "Northern Ireland", level: "ni", parent: null, children: [] };
  const byCode = new Map([[NI_CODE, ni]]);

  const deas = features
    .map((f) => ({ code: f.attributes.DEACode ?? uncodedDea, f }))
    .filter(({ code }) => code && deaNames[code])
    .map(({ code, f }) => ({
      code,
      name: deaNames[code],
      level: "dea",
      parentCode: councilOf(code),
      children: [],
      // Shape__Area is in square metres of the Irish Grid, accurate to well under 0.1%.
      areaKm2: f.attributes.Shape__Area / 1e6,
      rings: f.geometry.rings,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lgds = [...new Set(deas.map((d) => d.parentCode))]
    .map((code) => ({ code, name: lgdNames[code], level: "lgd", parent: ni, children: [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  lgds.forEach((lgd) => byCode.set(lgd.code, lgd));

  for (const dea of deas) {
    dea.parent = byCode.get(dea.parentCode);
    dea.parent.children.push(dea);
    byCode.set(dea.code, dea);
  }
  for (const lgd of lgds) lgd.areaKm2 = lgd.children.reduce((sum, d) => sum + d.areaKm2, 0);
  ni.children = lgds;
  ni.areaKm2 = lgds.reduce((sum, a) => sum + a.areaKm2, 0);

  return {
    ni,
    lgds,
    deas,
    /** The DEA whose feature has no DEACode in DAERA's layer, if any. */
    uncodedDea,
    get: (code) => byCode.get(code) ?? null,
    /** Every area at a level, e.g. all 80 DEAs. */
    atLevel: (level) => (level === "ni" ? [ni] : level === "lgd" ? lgds : deas),
  };
}

/** Breadcrumb trail from Northern Ireland down to (not including) the area. */
export function ancestors(area) {
  const trail = [];
  for (let a = area.parent; a; a = a.parent) trail.unshift(a);
  return trail;
}

export function describeArea(area, geo) {
  if (area.level === "ni") {
    return `Northern Ireland is made up of ${geo.lgds.length} councils (Local Government Districts) and ${geo.deas.length} District Electoral Areas.`;
  }
  if (area.level === "lgd") {
    return `${area.name} is one of ${geo.lgds.length} councils in Northern Ireland. It is made up of ${area.children.length} District Electoral Areas.`;
  }
  return `${area.name} is one of ${geo.deas.length} District Electoral Areas in Northern Ireland, and one of ${area.parent.children.length} in ${area.parent.name}.`;
}

// --- Search -------------------------------------------------------------------------------------

const POSTCODE = /^BT\d{1,2}\s*\d[A-Z]{2}$/i;

export const looksLikePostcode = (q) => POSTCODE.test(q.trim());

/** Ranked name matches across councils and DEAs (prefix matches first). */
export function searchAreas(geo, query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const all = [geo.ni, ...geo.lgds, ...geo.deas];
  return all
    .map((area) => {
      const name = area.name.toLowerCase();
      const at = name.indexOf(q);
      return { area, rank: at === 0 ? 0 : at > 0 ? 1 : -1 };
    })
    .filter((m) => m.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.area.name.localeCompare(b.area.name))
    .slice(0, limit)
    .map((m) => m.area);
}

/** Resolves a Northern Ireland postcode to the DEA that contains it (via postcodes.io). */
export async function findPostcode(geo, postcode) {
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Postcode lookup failed (${res.status})`);
  const { result } = await res.json();
  if (result?.longitude == null) return null;
  return geo.deas.find((dea) => containsPoint(dea.rings, result.longitude, result.latitude)) ?? null;
}

/** Even-odd test across all rings, so holes work whatever their orientation. */
function containsPoint(rings, x, y) {
  return rings.reduce((inside, ring) => (inRing(ring, x, y) ? !inside : inside), false);
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// --- Landing page silhouette --------------------------------------------------------------------

/**
 * SVG paths for each council (drawn from its DEAs), in a simple cos(latitude)-corrected
 * equirectangular projection, for the clickable Northern Ireland map on the landing page.
 */
export function councilPaths(geo, width = 400) {
  const all = geo.deas.flatMap((d) => d.rings.flat());
  const lons = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const kx = Math.cos(((minY + maxY) / 2) * (Math.PI / 180));
  const scale = width / ((maxX - minX) * kx);
  const height = Math.round((maxY - minY) * scale);
  const pt = ([x, y]) => `${((x - minX) * kx * scale).toFixed(1)},${((maxY - y) * scale).toFixed(1)}`;
  return {
    viewBox: `0 0 ${width} ${height}`,
    paths: geo.lgds.map((area) => ({
      area,
      d: area.children
        .flatMap((dea) => dea.rings)
        .map((ring) => `M${ring.map(pt).join("L")}Z`)
        .join(""),
    })),
  };
}
