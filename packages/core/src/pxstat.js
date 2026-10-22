// Minimal client for the NISRA Data Portal (PxStat) public API. Every table ("matrix") is fetched
// once as JSON-stat 2.0 and cached for the life of the page.

const API = "https://ws-data.nisra.gov.uk/public/api.restful/PxStat.Data.Cube_API.ReadDataset";

export const tableUrl = (matrix) => `https://data.nisra.gov.uk/table/${matrix}`;

const cache = new Map();

export function loadCube(matrix) {
  if (!cache.has(matrix)) {
    const promise = fetch(`${API}/${matrix}/JSON-stat/2.0/en`)
      .then((res) => {
        if (!res.ok) throw new Error(`NISRA Data Portal returned ${res.status} for ${matrix}`);
        return res.json();
      })
      .then((json) => new Cube(matrix, json));
    // Drop failures from the cache so a later render can retry.
    promise.catch(() => cache.delete(matrix));
    cache.set(matrix, promise);
  }
  return cache.get(matrix);
}

export class Cube {
  constructor(matrix, json) {
    this.matrix = matrix;
    this.label = json.label;
    this.updated = json.updated ? new Date(json.updated) : null;
    this.ids = json.id;
    this.size = json.size;
    this.values = json.value;
    this.dims = {};
    for (const id of json.id) {
      const { index, label = {} } = json.dimension[id].category;
      const list = Array.isArray(index) ? index : Object.keys(index).sort((a, b) => index[a] - index[b]);
      this.dims[id] = {
        codes: list,
        labels: label,
        position: Object.fromEntries(list.map((code, i) => [code, i])),
      };
    }
    this.timeDim = json.role?.time?.[0] ?? this.ids.find((id) => id.startsWith("TLIST"));
    this.times = this.dims[this.timeDim].codes;
  }

  has(dim, code) {
    return this.dims[dim]?.position[code] !== undefined;
  }

  /**
   * Value at one cell. `sel` maps dimension id → code; dimensions with a single category may be
   * omitted. Returns null for missing/suppressed cells or codes the table doesn't have.
   */
  value(sel) {
    let offset = 0;
    for (let i = 0; i < this.ids.length; i++) {
      const id = this.ids[i];
      const dim = this.dims[id];
      let pos;
      if (sel[id] !== undefined) pos = dim.position[sel[id]];
      else if (dim.codes.length === 1) pos = 0;
      else throw new Error(`${this.matrix}: no category chosen for dimension ${id}`);
      if (pos === undefined) return null;
      offset = offset * this.size[i] + pos;
    }
    const v = this.values[offset];
    return v === undefined || v === null ? null : v;
  }
}
