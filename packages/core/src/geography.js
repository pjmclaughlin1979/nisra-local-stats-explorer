// Northern Ireland's statistical geography hierarchy as used by the explorer:
// Northern Ireland → 11 Local Government Districts (councils) → 80 District Electoral Areas.

// `new URL(…, import.meta.url)` lets Vite emit the boundary files as hashed assets without any
// bundler-specific import syntax.
const lgdUrl = new URL("../data/lgd.json", import.meta.url).href;
const deaUrl = new URL("../data/dea.json", import.meta.url).href;

export const NI_CODE = "N92000002";

export const LEVELS = {
  ni: { name: "Northern Ireland", label: "Country", singular: "country", plural: "countries" },
  lgd: { name: "Local Government District", label: "Council", singular: "council", plural: "councils" },
  dea: { name: "District Electoral Area", label: "Electoral area", singular: "electoral area", plural: "electoral areas" },
};

export const boundaryUrls = { lgd: lgdUrl, dea: deaUrl };

let geographyPromise;

/** Loads both boundary files once and builds the area lookup. */
export function loadGeography() {
  geographyPromise ??= Promise.all([
    fetch(lgdUrl).then((r) => r.json()),
    fetch(deaUrl).then((r) => r.json()),
  ]).then(([lgdFc, deaFc]) => buildGeography(lgdFc, deaFc));
  return geographyPromise;
}

export function buildGeography(lgdFc, deaFc) {
  const ni = { code: NI_CODE, name: "Northern Ireland", level: "ni", parent: null, children: [] };
  const byCode = new Map([[NI_CODE, ni]]);

  const lgds = lgdFc.features.map((f) => {
    const area = { ...f.properties, level: "lgd", parent: ni, children: [], geometry: f.geometry };
    byCode.set(area.code, area);
    return area;
  });
  ni.children = lgds;
  ni.areaKm2 = lgds.reduce((sum, a) => sum + a.areaKm2, 0);

  const deas = deaFc.features.map((f) => {
    const parent = byCode.get(f.properties.parent);
    const area = { ...f.properties, level: "dea", parent, children: [], geometry: f.geometry };
    parent.children.push(area);
    byCode.set(area.code, area);
    return area;
  });

  return {
    ni,
    lgds,
    deas,
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
  return geo.deas.find((dea) => containsPoint(dea.geometry, result.longitude, result.latitude)) ?? null;
}

function containsPoint(geometry, x, y) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    (rings) => rings.reduce((inside, ring, i) => (inRing(ring, x, y) ? !inside : inside), false)
  );
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
 * SVG paths for each council, in a simple cos(latitude)-corrected equirectangular projection, for
 * the clickable Northern Ireland map on the landing page.
 */
export function councilPaths(geo, width = 400) {
  const ringsOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat();
  const all = geo.lgds.flatMap((a) => ringsOf(a.geometry).flat());
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
      d: ringsOf(area.geometry)
        .map((ring) => `M${ring.map(pt).join("L")}Z`)
        .join(""),
    })),
  };
}
