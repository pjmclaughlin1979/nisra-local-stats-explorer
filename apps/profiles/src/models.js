import { useEffect, useState } from "react";
import { categories, fmt, headlines, runIndicator } from "@nisra-explorer/core";

// Indicators by id, across the headline cards and every topic.
export const indicatorsById = Object.fromEntries(
  [...headlines, ...categories.flatMap((c) => c.indicators)].map((i) => [i.id, i])
);

// One promise per indicator + area, shared by the highlights grid and the topic sections so each
// statistic is computed once per page.
const cache = new Map();

export function loadModel(indicatorId, area, geo) {
  const key = `${indicatorId}:${area.code}`;
  if (!cache.has(key)) {
    const promise = runIndicator(indicatorsById[indicatorId], { area, geo });
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return cache.get(key);
}

export function useModel(indicatorId, area, geo) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    loadModel(indicatorId, area, geo).then(
      (model) => alive && setState({ status: "ready", model }),
      (error) => alive && setState({ status: "error", error })
    );
    return () => {
      alive = false;
    };
  }, [indicatorId, area, geo]);
  return state;
}

// --- Highlights: one headline number per topic ---------------------------------------------------

const rowValue = (model, label) => model.rows?.find((r) => r.label === label)?.values[0] ?? null;
const item = (model, label) => model.items?.find((i) => i.label === label) ?? null;

/**
 * For each topic, candidate statistics in order of preference; the first one available for the
 * area's geography level is shown. `pick` turns an indicator's view model into { label, value }.
 */
const HIGHLIGHTS = {
  people: [{ id: "population", pick: (m) => ({ label: "Total population", value: m.value }) }],
  health: [
    { id: "life-expectancy", pick: (m) => ({ label: "Female life expectancy", value: item(m, "Female")?.value }) },
  ],
  work: [
    { id: "work-status", pick: (m) => ({ label: "Employment rate (16-64)", value: fmt.percent(rowValue(m, "Employed")) }) },
    { id: "benefits", pick: (m) => ({ label: "Universal Credit claimants", value: item(m, "Universal Credit")?.value }) },
  ],
  education: [
    { id: "attainment", pick: (m) => ({ label: "School leavers with 5+ GCSEs A*-C inc. English & maths", value: m.items[0]?.value }) },
  ],
  environment: [
    { id: "ghg", pick: (m) => ({ label: "Greenhouse gas emissions", value: item(m, "Total emissions")?.value }) },
  ],
  crime: [
    { id: "recorded-crime", pick: (m) => ({ label: "Crimes per 1,000 population", value: m.items[0]?.value }) },
  ],
  business: [
    { id: "businesses", pick: (m) => ({ label: "Registered businesses", value: m.items[0]?.value }) },
    { id: "farms", pick: (m) => ({ label: "Farms", value: item(m, "Farms")?.value }) },
  ],
};

/** Resolves a topic's highlight for an area: { label, value, period, tables } or null. */
export async function loadHighlight(categoryId, area, geo) {
  for (const candidate of HIGHLIGHTS[categoryId] ?? []) {
    const model = await loadModel(candidate.id, area, geo);
    if (model.kind === "unavailable") continue;
    const picked = candidate.pick(model);
    if (picked.value == null || picked.value === "–") continue;
    return { ...picked, period: model.period, tables: model.tables };
  }
  return null;
}
