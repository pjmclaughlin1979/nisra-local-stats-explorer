// SVG outline map for the profile hero: every DEA drawn in a cos(latitude)-corrected projection,
// framed on the area's surroundings, with the area itself highlighted.

let projected;

function project(geo) {
  if (projected?.geo === geo) return projected;
  const all = geo.deas.flatMap((d) => d.rings.flat());
  const midLat = all.reduce((sum, p) => sum + p[1], 0) / all.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const toXY = ([lon, lat]) => [lon * kx * 1000, -lat * 1000];
  const shapes = new Map(
    geo.deas.map((dea) => {
      const rings = dea.rings.map((ring) => ring.map(toXY));
      const xs = rings.flat().map((p) => p[0]);
      const ys = rings.flat().map((p) => p[1]);
      return [dea.code, { rings, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }];
    })
  );
  projected = { geo, shapes };
  return projected;
}

const deasOf = (area, geo) =>
  area.level === "dea" ? [area] : area.level === "lgd" ? area.children : geo.deas;

function boxOf(deas, shapes) {
  return deas
    .map((d) => shapes.get(d.code).box)
    .reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
}

const pathOf = (rings) => rings.map((r) => `M${r.map((p) => p.map((n) => n.toFixed(1)).join(",")).join("L")}Z`).join("");

/**
 * @returns {{ viewBox: string, context: string, focus: string }} SVG path data for the
 *   surrounding DEAs (context) and the area itself (focus).
 */
export function heroOutline(area, geo) {
  const { shapes } = project(geo);
  const focusDeas = deasOf(area, geo);
  // Frame the area with its neighbours around it (Northern Ireland on its own fills the frame).
  const [fx0, fy0, fx1, fy1] = boxOf(focusDeas, shapes);
  const grow = area.level === "ni" ? 0 : 0.9;
  const [x0, y0, x1, y1] = [fx0 - (fx1 - fx0) * grow, fy0 - (fy1 - fy0) * grow, fx1 + (fx1 - fx0) * grow, fy1 + (fy1 - fy0) * grow];
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
  const focusCodes = new Set(focusDeas.map((d) => d.code));
  return {
    viewBox: `${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(x1 - x0 + pad * 2).toFixed(1)} ${(y1 - y0 + pad * 2).toFixed(1)}`,
    context: pathOf(geo.deas.filter((d) => !focusCodes.has(d.code)).flatMap((d) => shapes.get(d.code).rings)),
    focus: pathOf(focusDeas.flatMap((d) => shapes.get(d.code).rings)),
  };
}
