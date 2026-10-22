// Every statistic on an area page, defined once and rendered by both the React and Svelte apps.
//
// An indicator's `load(scope)` reads live tables from the NISRA Data Portal and returns a small,
// framework-free view model:
//   { kind: "headline", period, value, unit, lines, change, comparisons }
//   { kind: "bars", period, series: [{ code, name, role }], rows: [{ label, values }] }
//   { kind: "figures", period, items: [{ label, value, detail, comparisons }] }
//   { kind: "unavailable", message }
// `runIndicator` adds `tables` (the source tables used, for "Access data at" links).

import { loadCube, tableUrl } from "./pxstat.js";
import { LEVELS } from "./geography.js";
import * as fmt from "./format.js";

// --- Reading tables -----------------------------------------------------------------------------

// A spec says where each geography level's numbers live:
//   { sources: { ni?, lgd?, dea? }, summable? }
// where each source is { matrix, geo?, sel?, dims? }:
//   geo  – dimension holding area codes (defaults to LGD2014 / DEA2014)
//   sel  – fixed selections applied to every read (e.g. { Sex: "All" })
//   dims – renames logical dimension keys used by the indicator to this table's ids, so one
//          indicator can read e.g. general health from both a council and a DEA census table.
// `summable` lets an area missing from a table be built by adding up smaller areas (NI from its
// councils, a council from its DEAs) — only valid for counts, never rates or averages.

function pickSource({ sources, summable }, area) {
  const { ni, lgd, dea } = sources;
  if (area.level === "dea") return dea && { ...dea, tableLevel: "dea" };
  if (area.level === "lgd") {
    if (lgd) return { ...lgd, tableLevel: "lgd" };
    return summable && dea ? { ...dea, tableLevel: "dea" } : null;
  }
  if (ni) return { ...ni, tableLevel: "ni" };
  if (lgd) return { ...lgd, tableLevel: "lgd" };
  return summable && dea ? { ...dea, tableLevel: "dea" } : null;
}

async function openReader(spec, area, geo, used) {
  const src = pickSource(spec, area);
  if (!src) return null;
  const cube = await loadCube(src.matrix);
  used?.set(cube.matrix, cube);
  const geoDim = src.geo ?? (cube.dims.DEA2014 ? "DEA2014" : "LGD2014");

  let codes = [area.code];
  if (!cube.has(geoDim, area.code)) {
    if (!spec.summable) return null;
    const parts =
      src.tableLevel === "dea" ? (area.level === "ni" ? geo.deas : area.children) : geo.lgds;
    codes = parts.map((p) => p.code);
    if (!codes.length || !codes.every((c) => cube.has(geoDim, c))) return null;
  }

  const rename = (sel) =>
    Object.fromEntries(Object.entries(sel).map(([k, v]) => [src.dims?.[k] ?? k, v]));

  const get = (sel = {}, time) => {
    const cell = { ...src.sel, ...rename(sel), [cube.timeDim]: time };
    let total = null;
    for (const code of codes) {
      const v = cube.value({ ...cell, [geoDim]: code });
      if (v != null) total = (total ?? 0) + v;
    }
    return total;
  };

  return {
    cube,
    times: cube.times,
    get,
    /** Most recent period that has data for this selection. */
    latest(sel = {}) {
      for (let i = cube.times.length - 1; i >= 0; i--) {
        if (get(sel, cube.times[i]) != null) return cube.times[i];
      }
      return null;
    },
    /** `time` if this table has it, otherwise its own latest period. */
    align(time, sel = {}) {
      return cube.times.includes(time) ? time : this.latest(sel);
    },
  };
}

/** The areas shown side by side: the selected area, Northern Ireland, and any comparison area. */
function seriesFor(scope) {
  const { area, compare, geo } = scope;
  const out = [{ area, role: "area" }];
  if (area.level !== "ni") out.push({ area: geo.ni, role: "ni" });
  if (compare && compare.code !== area.code) out.push({ area: compare, role: "compare" });
  return out;
}

function unavailable(spec) {
  const levels = ["ni", "lgd", "dea"].filter(
    (l) => spec.sources[l] || (l === "ni" && (spec.sources.lgd || spec.summable))
  );
  const names = levels.map((l) => (l === "ni" ? "Northern Ireland" : LEVELS[l].plural));
  return {
    kind: "unavailable",
    message: `Data is available for ${names.join(" and ")}.`,
  };
}

/** Comparison strings for figure items: [{ name, value }] for NI and the comparison area. */
function comparisonsOf(series, values, format) {
  return series
    .map((s, i) => ({ s, v: values[i] }))
    .filter(({ s }) => s.role !== "area")
    .map(({ s, v }) => ({ name: s.role === "ni" ? "NI" : s.area.name, value: format(v) }));
}

const growth = (now, then) => (now != null && then ? ((now - then) / then) * 100 : null);

// --- Indicator builders -------------------------------------------------------------------------

/** Percentage breakdown of a count across categories (e.g. age bands, religion). */
function shareBars({ summable = true, groups, period, ...spec }) {
  spec.summable = summable;
  return async (scope) => {
    const series = seriesFor(scope);
    const readers = await Promise.all(series.map((s) => scope.open(spec, s.area)));
    if (!readers[0]) return unavailable(spec);
    const probe = { cat: groups[0].codes[0] };
    const time = period ?? readers[0].latest(probe);
    const columns = readers.map((r) => {
      if (!r) return groups.map(() => null);
      const t = r.align(time, probe);
      const counts = groups.map((g) =>
        g.codes.reduce((sum, code) => sum + (r.get({ cat: code }, t) ?? 0), 0)
      );
      const total = counts.reduce((a, b) => a + b, 0);
      return counts.map((c) => (total ? (c / total) * 100 : null));
    });
    return {
      kind: "bars",
      period: time,
      series: series.map((s) => ({ code: s.area.code, name: s.area.name, role: s.role })),
      rows: groups.map((g, gi) => ({ label: g.label, values: columns.map((col) => col[gi]) })),
    };
  };
}

/** Bars for values that are already percentages (rates published by NISRA). */
function rateBars({ rows, ...spec }) {
  return async (scope) => {
    const series = seriesFor(scope);
    const readers = await Promise.all(series.map((s) => scope.open(spec, s.area)));
    if (!readers[0]) return unavailable(spec);
    const time = readers[0].latest(rows[0].sel);
    return {
      kind: "bars",
      period: time,
      series: series.map((s) => ({ code: s.area.code, name: s.area.name, role: s.role })),
      rows: rows.map((row) => ({
        label: row.label,
        values: readers.map((r) => (r ? r.get(row.sel, r.align(time, row.sel)) : null)),
      })),
    };
  };
}

/**
 * One headline figure per row, each with NI / comparison values alongside.
 * Each item: { label, spec, sel, format, detail?(value, time) , derive?(read, time) }
 */
function figures(items) {
  return async (scope) => {
    const series = seriesFor(scope);
    const out = [];
    const periods = new Set();
    for (const item of items) {
      const readers = await Promise.all(series.map((s) => scope.open(item.spec, s.area)));
      if (!readers[0]) continue;
      const time = readers[0].latest(item.sel);
      if (time == null) continue;
      periods.add(time);
      const values = await Promise.all(
        readers.map(async (r, i) => {
          if (!r) return null;
          const t = r.align(time, item.sel);
          return item.derive
            ? item.derive({ r, t, area: series[i].area, scope })
            : r.get(item.sel, t);
        })
      );
      out.push({
        label: item.label,
        value: item.format(values[0]),
        detail: item.detail?.(values[0], time) ?? null,
        comparisons: comparisonsOf(series, values, item.format),
      });
    }
    if (!out.length) return unavailable(items[0].spec);
    return { kind: "figures", period: [...periods].join(", "), items: out };
  };
}

// --- Shared specs ------------------------------------------------------------------------------

const POPULATION = {
  summable: true,
  sources: {
    lgd: { matrix: "MYE01T06", sel: { rounded_unrounded: "Unrounded" } },
    dea: { matrix: "MYE01T010", sel: { broadage4: "All", Sex: "All" } },
  },
};

/** Mid-year population for an area, for the given year or the nearest earlier one available. */
async function population(scope, area, year) {
  const r = await scope.open(POPULATION, area);
  if (!r) return null;
  const y = String(year).slice(0, 4);
  const candidates = r.times.filter((t) => t <= y);
  const t = candidates.length ? candidates[candidates.length - 1] : r.latest();
  return r.get({}, t);
}

const census = (matrix, dim, groups) =>
  shareBars({
    period: "2021",
    sources: { lgd: { matrix, dims: { cat: dim } } },
    groups,
  });

const g = (label, ...codes) => ({ label, codes });

// --- Headline cards ----------------------------------------------------------------------------

async function loadPopulation(scope) {
  const { area, geo } = scope;
  const r = await scope.open(POPULATION, area);
  if (!r) return unavailable(POPULATION);
  const time = r.latest();
  const value = r.get({}, time);
  const lines = [];

  if (area.level !== "ni") {
    const ni = await scope.open(POPULATION, geo.ni);
    const niValue = ni?.get({}, ni.align(time));
    if (niValue) lines.push({ badge: fmt.percent((value / niValue) * 100), after: "of Northern Ireland population" });

    const peers = geo.atLevel(area.level);
    const peerValues = await Promise.all(
      peers.map(async (p) => (await scope.open(POPULATION, p))?.get({}, time) ?? 0)
    );
    const rank = peerValues.filter((v) => v > value).length + 1;
    const largest = rank <= peers.length / 2;
    const position = largest ? rank : peers.length - rank + 1;
    lines.push({
      text: `The ${fmt.ordinal(position)}${largest ? "largest" : "smallest"} population of ${peers.length} ${LEVELS[area.level].plural}`,
    });
  }

  // Ten-year change where the series allows it, otherwise since its first year.
  const base = r.times.includes(String(Number(time) - 10)) ? String(Number(time) - 10) : r.times[0];
  const change = growth(value, r.get({}, base));

  const comparisons = [];
  if (scope.compare && scope.compare.code !== area.code) {
    const c = await scope.open(POPULATION, scope.compare);
    comparisons.push({ name: scope.compare.name, value: fmt.number(c?.get({}, c.align(time))) });
  }

  return {
    kind: "headline",
    period: `Population estimates ${time}`,
    value: fmt.number(value),
    unit: null,
    lines,
    change:
      change == null
        ? null
        : { direction: change >= 0 ? "up" : "down", text: `${fmt.percent(Math.abs(change))} since ${base}` },
    comparisons,
  };
}

async function density(scope, area) {
  if (area.level !== "dea") {
    const r = await scope.open({ sources: { lgd: { matrix: "PD01T02" } } }, area);
    if (!r) return null;
    const time = r.latest();
    return { value: r.get({}, time), time };
  }
  const r = await scope.open(POPULATION, area);
  const time = r.latest();
  return { value: r.get({}, time) / area.areaKm2, time };
}

async function loadDensity(scope) {
  const { area, geo } = scope;
  const own = await density(scope, area);
  if (!own) return unavailable({ sources: { lgd: true, dea: true } });
  const lines = [];
  if (area.level !== "ni") {
    const ni = await density(scope, geo.ni);
    const ratio = own.value / ni.value;
    lines.push(
      ratio >= 1.5
        ? { text: "Approximately", badge: `${fmt.number(ratio, ratio < 10 ? 1 : 0)} times`, after: "the Northern Ireland average" }
        : ratio > 0.67
          ? { text: "Similar to the Northern Ireland average", after: `(${fmt.number(ni.value, 1)})` }
          : { text: "About", badge: fmt.percent(ratio * 100, 0), after: "of the Northern Ireland average" }
    );
  }
  const comparisons = [];
  if (scope.compare && scope.compare.code !== area.code) {
    const c = await density(scope, scope.compare);
    comparisons.push({ name: scope.compare.name, value: fmt.number(c?.value, 1) });
  }
  return {
    kind: "headline",
    period: `Population estimates ${own.time}`,
    value: fmt.number(own.value, 1),
    unit: "people per square kilometre",
    lines,
    change: null,
    comparisons,
  };
}

export const headlines = [
  {
    id: "population",
    title: "Population",
    description:
      "Population is based on the number of usual residents at 30th June in the mid-year population estimates.",
    load: loadPopulation,
  },
  {
    id: "density",
    title: "Population density",
    description:
      "Population density is the number of usual residents per square kilometre. For District Electoral Areas it is calculated from the mid-year estimate and the area's boundary.",
    load: loadDensity,
  },
];

// --- Topic sections ----------------------------------------------------------------------------

const lgdOnly = (matrix, sel) => ({ sources: { lgd: { matrix, sel } } });

export const categories = [
  {
    id: "people",
    title: "People and communities",
    icon: "people",
    indicators: [
      {
        id: "age",
        title: "Age",
        description: "Mid-year population estimates by broad age band.",
        load: shareBars({
          sources: {
            lgd: { matrix: "MYE01T04", sel: { Sex: "All" }, dims: { cat: "broadage4" } },
            dea: { matrix: "MYE01T010", sel: { Sex: "All" }, dims: { cat: "broadage4" } },
          },
          groups: [g("0-15", "1"), g("16-39", "2"), g("40-64", "3"), g("65+", "4")],
        }),
      },
      {
        id: "household-size",
        title: "Household size",
        description: "Census 2021: the number of usual residents in the household.",
        load: census("TS027", "HH_SIZE_TC6", [
          g("1 person", "1"),
          g("2 people", "2"),
          g("3 people", "3"),
          g("4 people", "4"),
          g("5 or more people", "5", "6"),
        ]),
      },
      {
        id: "religion",
        title: "Religion, religion brought up in",
        description:
          "Census 2021: the religious group the person belongs to or, for people with no current religion, their religion of upbringing.",
        load: census("TS014", "RELIGION_OR_RELIGION_BROUGHT_UP_IN", [
          g("Catholic", "1"),
          g("Protestant & other Christian", "2"),
          g("Other religions", "3"),
          g("None", "4"),
        ]),
      },
      {
        id: "language",
        title: "Main language",
        description: "Census 2021: main language of usual residents aged 3 and over.",
        load: census("TS010", "MAIN_LANGUAGE_AGG2", [g("English", "1"), g("Other languages", "2")]),
      },
      {
        id: "house-price",
        title: "Average house price",
        description: "Standardised house price from the Northern Ireland House Price Index.",
        load: figures([
          {
            label: "Standardised price",
            spec: lgdOnly("LPSHPI01", { STATISTIC: "SP" }),
            sel: {},
            format: fmt.pounds,
          },
          {
            label: "Change since 2015 Q1",
            spec: lgdOnly("LPSHPI01", { STATISTIC: "SP" }),
            sel: {},
            derive: ({ r, t }) => growth(r.get({}, t), r.get({}, "2015Q1")),
            format: (v) => (v == null ? "–" : `${v >= 0 ? "+" : ""}${fmt.percent(v)}`),
          },
        ]),
      },
      {
        id: "housing-stock",
        title: "Housing stock",
        description: "Domestic properties by type, from Land & Property Services valuation lists.",
        load: shareBars({
          sources: { lgd: { matrix: "NIHSLGD", dims: { cat: "ACCTYPE" } } },
          groups: [g("Apartment", "1"), g("Detached", "2"), g("Semi-detached", "3"), g("Terrace", "4")],
        }),
      },
    ],
  },
  {
    id: "health",
    title: "Health and social care",
    icon: "health",
    indicators: [
      {
        id: "general-health",
        title: "General health",
        description:
          "Census 2021: a self-assessment of a person's general state of health, not based over any specified period of time.",
        load: shareBars({
          period: "2021",
          sources: {
            lgd: { matrix: "TS016", dims: { cat: "HEALTH_IN_GENERAL" } },
            dea: { matrix: "C21007DEA", dims: { cat: "GENERAL_HEALTH" } },
          },
          groups: [g("Very good", "1"), g("Good", "2"), g("Fair", "3"), g("Bad", "4"), g("Very bad", "5")],
        }),
      },
      {
        id: "wellbeing",
        title: "Personal wellbeing",
        description:
          "Average scores out of 10 for people aged 16+, where 0 is 'not at all' and 10 is 'completely'. Loneliness is the percentage of people aged 16+ who were lonely 'often/always' or 'some of the time'.",
        load: figures(
          [
            ["Happiness", "WBPERSWLGD", "WBPERSWOTHR", "WBHAP", (v) => (v == null ? "–" : `${fmt.number(v, 1)} / 10`)],
            ["Life satisfaction", "WBPERSWLGD", "WBPERSWOTHR", "WBLIFE", (v) => (v == null ? "–" : `${fmt.number(v, 1)} / 10`)],
            ["Loneliness", "WBLONLGD", "WBLONOTHR", null, (v) => fmt.percent(v)],
          ].map(([label, lgd, ni, stat, format]) => ({
            label,
            spec: {
              sources: {
                ni: { matrix: ni, geo: "OTHRCAT", sel: stat ? { STATISTIC: stat } : {} },
                lgd: { matrix: lgd, sel: stat ? { STATISTIC: stat } : {} },
              },
            },
            sel: {},
            format,
          }))
        ),
      },
      {
        id: "life-expectancy",
        title: "Life expectancy at birth",
        description:
          "The average number of years a person born in the current period could expect to live if current mortality patterns remain constant.",
        load: figures(
          [
            ["Male", "2"],
            ["Female", "1"],
          ].map(([label, sex]) => ({
            label,
            spec: {
              sources: {
                lgd: { matrix: "LELGD", sel: { SEX: sex } },
                dea: { matrix: "LEDEA", sel: { SEX: sex } },
              },
            },
            sel: {},
            format: (v) => (v == null ? "–" : `${fmt.number(v, 1)} years`),
          }))
        ),
      },
      {
        id: "unpaid-care",
        title: "Unpaid care giving",
        description:
          "Census 2021: hours per week of unpaid care given to anyone with long-term physical or mental health conditions or problems related to old age. Persons aged 5 and over.",
        load: census("TS018", "UNPAID_CARE_AGG4", [
          g("Provides no unpaid care", "1"),
          g("1-19 hours", "2"),
          g("20-49 hours", "3"),
          g("50+ hours", "4"),
        ]),
      },
      {
        id: "gp",
        title: "GP practices",
        description:
          "GP practices and registered patients by practice location. Council figures are the sum of their District Electoral Areas.",
        load: figures([
          {
            label: "GP practices",
            spec: { summable: true, sources: { dea: { matrix: "GPPRACPATDEA" } } },
            sel: { STATISTIC: "PRACS" },
            format: (v) => fmt.number(v),
          },
          {
            label: "Average patients per practice",
            spec: { summable: true, sources: { dea: { matrix: "GPPRACPATDEA" } } },
            sel: { STATISTIC: "PRACS" },
            derive: ({ r, t }) => {
              const practices = r.get({ STATISTIC: "PRACS" }, t);
              return practices ? r.get({ STATISTIC: "REGPAT" }, t) / practices : null;
            },
            format: (v) => fmt.number(v),
          },
        ]),
      },
    ],
  },
  {
    id: "work",
    title: "Work, pay and benefits",
    icon: "work",
    indicators: [
      {
        id: "work-status",
        title: "Work status of adults",
        description:
          "Labour Force Survey rates. Unemployment is based on those aged 16 and over; employment and inactivity on those aged 16 to 64. Inactive includes students, early retirees, people looking after a home, and the long-term sick or disabled.",
        load: rateBars({
          sources: { lgd: { matrix: "LMSLGD" } },
          rows: [
            { label: "Employed", sel: { STATISTIC: "EMPR" } },
            { label: "Unemployed", sel: { STATISTIC: "UNEMPR" } },
            { label: "Inactive", sel: { STATISTIC: "INACTR" } },
          ],
        }),
      },
      {
        id: "wages",
        title: "Work and wages",
        description:
          "People employed is from the Labour Force Survey. Median weekly pay is gross weekly earnings for full-time employees (ASHE), by place of residence.",
        load: figures([
          {
            label: "People employed",
            spec: lgdOnly("LMSLGD"),
            sel: { STATISTIC: "EMPN" },
            format: (v) => fmt.number(v),
          },
          {
            label: "Median weekly pay (full-time)",
            spec: lgdOnly("GHWPLGD", { STATISTIC: "Median", PR: "Wkly", WP: "FT", Sex: "All" }),
            sel: {},
            format: fmt.pounds,
          },
        ]),
      },
      {
        id: "benefits",
        title: "Benefit claimants",
        description:
          "Claimants in February of each year, with the percentage of the mid-year population for that year.",
        load: figures(
          [
            ["Universal Credit", "UC"],
            ["Personal Independence Payment", "PIP"],
            ["State Pension", "RP"],
          ].map(([label, stat]) => ({
            label,
            spec: {
              summable: true,
              sources: { lgd: { matrix: "BSLGD" }, dea: { matrix: "BSDEA" } },
            },
            sel: { STATISTIC: stat },
            derive: async ({ r, t, area, scope }) => {
              const claimants = r.get({ STATISTIC: stat }, t);
              const pop = await population(scope, area, t);
              return claimants == null ? null : { claimants, share: pop ? (claimants / pop) * 100 : null };
            },
            format: (v) => (v == null ? "–" : `${fmt.percent(v.share)} of population`),
            detail: (v) => (v == null ? null : `${fmt.number(v.claimants)} claimants`),
          }))
        ),
      },
    ],
  },
  {
    id: "education",
    title: "Education and skills",
    icon: "education",
    indicators: [
      {
        id: "pupils",
        title: "Pupils in school",
        description: "School census: pupils enrolled in primary (including nursery and reception) and post-primary schools.",
        load: figures(
          [
            ["Primary school", "DESCPLGD", "DESCPDEA"],
            ["Post-primary school", "DESCPPLGD", "DESCPPDEA"],
          ].map(([label, lgd, dea]) => ({
            label,
            spec: { summable: true, sources: { lgd: { matrix: lgd }, dea: { matrix: dea } } },
            sel: { STATISTIC: "Male" },
            derive: ({ r, t }) => sumOrNull(r.get({ STATISTIC: "Male" }, t), r.get({ STATISTIC: "Female" }, t)),
            format: (v) => fmt.number(v),
          }))
        ),
      },
      {
        id: "fsm",
        title: "Pupils entitled to free school meals",
        description: "Percentage of pupils entitled to free school meals, from the school census.",
        load: figures(
          [
            ["Primary school", "DESCPLGD", "DESCPDEA"],
            ["Post-primary school", "DESCPPLGD", "DESCPPDEA"],
          ].map(([label, lgd, dea]) => ({
            label,
            spec: { summable: true, sources: { lgd: { matrix: lgd }, dea: { matrix: dea } } },
            sel: { STATISTIC: "FSME" },
            derive: ({ r, t }) => {
              const pupils = sumOrNull(r.get({ STATISTIC: "Male" }, t), r.get({ STATISTIC: "Female" }, t));
              const fsme = r.get({ STATISTIC: "FSME" }, t);
              return pupils && fsme != null ? (fsme / pupils) * 100 : null;
            },
            format: (v) => fmt.percent(v),
          }))
        ),
      },
      {
        id: "qualifications",
        title: "Highest level of qualification",
        description:
          "Census 2021: highest level of qualification held by usual residents aged 16 and over. Level 1 is 1-4 GCSEs; Level 2 is 5+ GCSEs (A*-C); Level 3 is 2+ A levels; Level 4+ is degree level and above.",
        load: census("TS021", "HIGHEST_QUALIFICATION", [
          g("No qualifications", "1"),
          g("Level 1", "2"),
          g("Level 2", "3"),
          g("Apprenticeship", "4"),
          g("Level 3", "5"),
          g("Level 4 and above", "6"),
          g("Other", "7"),
        ]),
      },
      {
        id: "attainment",
        title: "Attainment of school leavers",
        description:
          "Percentage of school leavers with at least 5 GCSEs at grades A*-C (including equivalents), including GCSE English and maths.",
        load: figures([
          {
            label: "5+ GCSEs A*-C inc. English and maths",
            spec: {
              sources: {
                lgd: { matrix: "DESLSALGD", sel: { STATISTIC: "PercSL", FSME: "All" } },
                dea: { matrix: "DESLSADEA", sel: { STATISTIC: "PercSL", FSME: "All" } },
              },
            },
            sel: { ATTAIN: "fivegcseatocincengmath" },
            format: (v) => fmt.percent(v),
          },
        ]),
      },
      {
        id: "destinations",
        title: "Next steps for school leavers",
        description: "Destinations of school leavers, from the School Leavers Survey.",
        load: rateBars({
          sources: {
            lgd: { matrix: "DESLSDLGD", sel: { STATISTIC: "PercSL", FSME: "All" } },
            dea: { matrix: "DESLSDDEA", sel: { STATISTIC: "PercSL" } },
          },
          rows: [
            { label: "Higher education", sel: { DESTINATION: "destHE" } },
            { label: "Further education", sel: { DESTINATION: "destFE" } },
            { label: "Employment", sel: { DESTINATION: "destEmploy" } },
            { label: "Training", sel: { DESTINATION: "destTrain" } },
            { label: "Unemployed or unknown", sel: { DESTINATION: "destUnempUnk" } },
          ],
        }),
      },
    ],
  },
  {
    id: "environment",
    title: "Transport, environment and climate change",
    icon: "environment",
    indicators: [
      {
        id: "env-concern",
        title: "Concern about the environment",
        description: "Continuous Household Survey: households concerned about the environment.",
        load: rateBars({
          sources: { lgd: { matrix: "CHSCONCERNLGD" } },
          rows: [
            { label: "Concerned", sel: { STATISTIC: "CONCERNENVI" } },
            { label: "Not concerned", sel: { STATISTIC: "NOTCONCERNENVI" } },
          ],
        }),
      },
      {
        id: "ghg",
        title: "Greenhouse gas emissions",
        description: "Territorial greenhouse gas emissions (all sectors), in kilotonnes of carbon dioxide equivalent.",
        load: figures([
          {
            label: "Total emissions",
            spec: lgdOnly("GHGALL", { STATISTIC: "GHGALL", GHGSECTOR: "GTALL" }),
            sel: {},
            format: (v) => (v == null ? "–" : `${fmt.number(v)} ktCO2e`),
          },
          {
            label: "Reduction since 2005",
            spec: lgdOnly("GHGALL", { STATISTIC: "GHGALL", GHGSECTOR: "GTALL" }),
            sel: {},
            derive: ({ r, t }) => {
              const change = growth(r.get({}, t), r.get({}, "2005"));
              return change == null ? null : -change;
            },
            format: (v) => fmt.percent(v),
          },
        ]),
      },
      {
        id: "waste",
        title: "Local authority collected waste",
        description: "How local authority collected municipal waste was managed.",
        load: rateBars({
          sources: { lgd: { matrix: "WASTELGD" } },
          rows: [
            { label: "Recycled", sel: { STATISTIC: "LACMWR" } },
            { label: "Landfill", sel: { STATISTIC: "LACMWL" } },
            { label: "Energy recovery", sel: { STATISTIC: "LACMWER" } },
          ],
        }),
      },
    ],
  },
  {
    id: "crime",
    title: "Crime and justice",
    icon: "crime",
    indicators: [
      {
        id: "recorded-crime",
        title: "Police recorded crimes",
        description: "All crimes recorded by the police, with a rate per 1,000 population based on the mid-year estimate.",
        load: figures([
          {
            label: "Crimes per 1,000 population",
            spec: {
              summable: true,
              sources: { lgd: { matrix: "PRCLGD" }, dea: { matrix: "PRCDEA" } },
            },
            sel: { crmclass: "All" },
            derive: async ({ r, t, area, scope }) => {
              const crimes = r.get({ crmclass: "All" }, t);
              const pop = await population(scope, area, t);
              return crimes == null ? null : { crimes, rate: pop ? (crimes / pop) * 1000 : null };
            },
            format: (v) => (v == null ? "–" : fmt.number(v.rate)),
            detail: (v) => (v == null ? null : `${fmt.number(v.crimes)} crimes recorded`),
          },
        ]),
      },
      {
        id: "crime-types",
        title: "Types of crime",
        description: "Share of police recorded crime by offence group.",
        load: shareBars({
          sources: {
            lgd: { matrix: "PRCLGD", dims: { cat: "crmclass" } },
            dea: { matrix: "PRCDEA", dims: { cat: "crmclass" } },
          },
          groups: [
            g("Violence against the person", "1", "2", "3"),
            g("Sexual offences", "4"),
            g("Robbery", "5"),
            g("Burglary", "6", "7", "8", "9"),
            g("Other theft offences", "10", "11", "12", "13", "14"),
            g("Criminal damage", "15"),
            g("Other crimes against society", "16", "17", "18", "19", "20"),
          ],
        }),
      },
      {
        id: "worry",
        title: "Worry about crime and anti-social behaviour",
        description:
          "Northern Ireland Crime Survey: people with a high level of worry about crime, and those who perceive a high level of anti-social behaviour in their area.",
        load: figures([
          {
            label: "Highly worried about crime",
            spec: lgdOnly("TWORRYCRMLGD", { STATISTIC: "WorryC2" }),
            sel: {},
            format: (v) => fmt.percent(v),
          },
          {
            label: "High level of anti-social behaviour",
            spec: lgdOnly("TNISCSASBLGD", { STATISTIC: "ASB8" }),
            sel: {},
            format: (v) => fmt.percent(v),
          },
        ]),
      },
    ],
  },
  {
    id: "business",
    title: "Business, economy and trade",
    icon: "business",
    indicators: [
      {
        id: "businesses",
        title: "Number of businesses",
        description: "VAT and/or PAYE registered businesses (IDBR).",
        load: figures([
          {
            label: "Businesses",
            spec: lgdOnly("BUSINESSBIGLGD"),
            sel: { BroadIndustryGroup: "All" },
            format: (v) => fmt.number(v),
          },
        ]),
      },
      {
        id: "business-types",
        title: "Type of businesses",
        description: "Registered businesses by broad industry group.",
        load: shareBars({
          sources: { lgd: { matrix: "BUSINESSBIGLGD", dims: { cat: "BroadIndustryGroup" } } },
          groups: [
            g("Agriculture", "1"),
            g("Production", "3"),
            g("Construction", "4"),
            g("Services", ...Array.from({ length: 14 }, (_, i) => String(i + 5))),
          ],
        }),
      },
      {
        id: "farms",
        title: "Farms",
        description: "Farm Census: number of farms and farmers.",
        load: figures(
          [
            ["Farms", "F"],
            ["Farmers", "FA"],
          ].map(([label, stat]) => ({
            label,
            spec: { summable: true, sources: { lgd: { matrix: "FCLGD" }, dea: { matrix: "FCDEA" } } },
            sel: { STATISTIC: stat },
            format: (v) => fmt.number(v),
          }))
        ),
      },
    ],
  },
];

function sumOrNull(a, b) {
  return a == null && b == null ? null : (a ?? 0) + (b ?? 0);
}

// --- Running -----------------------------------------------------------------------------------

/**
 * Loads one indicator for an area (optionally against a comparison area) and returns its view
 * model plus the source tables it read.
 */
export async function runIndicator(indicator, { area, compare = null, geo }) {
  const used = new Map();
  const scope = { area, compare, geo, open: (spec, a) => openReader(spec, a, geo, used) };
  const model = await indicator.load(scope);
  model.tables = [...used.values()].map((cube) => ({
    matrix: cube.matrix,
    label: cube.label,
    updated: fmt.date(cube.updated),
    url: tableUrl(cube.matrix),
  }));
  return model;
}
