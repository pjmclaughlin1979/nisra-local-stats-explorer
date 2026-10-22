import { useEffect, useState } from "react";
import { LEVELS, categories, describeArea, icons, searchAreas } from "@nisra-explorer/core";
import { go, profileHref, searchHref } from "../router.js";
import { loadHighlight } from "../models.js";
import OutlineMap from "./OutlineMap.jsx";

const LEVEL_ORDER = { ni: 0, lgd: 1, dea: 2 };
const SIZES = [10, 25, 50];

export default function ResultsPage({ geo, params }) {
  const q = params.q ?? "";
  const level = params.level ?? "";
  const within = params.within ?? "";
  const topic = params.topic ?? "";
  const size = SIZES.includes(Number(params.size)) ? Number(params.size) : 10;
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Text and council filters first, so the level counts reflect them.
  const matching = q ? new Set(searchAreas(geo, q, Infinity)) : null;
  const council = within ? geo.get(within) : null;
  const base = [geo.ni, ...geo.lgds, ...geo.deas]
    .filter((a) => !matching || matching.has(a))
    .filter((a) => !council || a === council || a.parent === council);
  const counts = { ni: 0, lgd: 0, dea: 0 };
  base.forEach((a) => counts[a.level]++);
  const results = base
    .filter((a) => !level || a.level === level)
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name));

  const pages = Math.max(1, Math.ceil(results.length / size));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);
  const shown = results.slice((page - 1) * size, page * size);
  const featured = results[0] ?? null;

  const set = (changes) =>
    go(searchHref({ q, level, within, topic, size: size === 10 ? null : size, ...changes, page: changes.page ?? null }));
  const activeFilters = [level, within, topic].filter(Boolean).length;

  return (
    <div className={`results ${filtersOpen ? "" : "results--collapsed"}`}>
      <aside className="filters" aria-label="Filters">
        <div className="filters__head">
          <button className="icon-btn" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" /></svg>
            <span className="sr-only">Toggle filters</span>
          </button>
          {filtersOpen && (
            <>
              <strong>{activeFilters} Filters</strong>
              {activeFilters > 0 && (
                <button className="link-btn" onClick={() => go(searchHref({ q }))}>
                  Clear all
                </button>
              )}
            </>
          )}
        </div>
        {filtersOpen && (
          <>
            <FilterGroup title="Geographies">
              <FilterOption selected={!level} onClick={() => set({ level: null })} label="All geographies" count={base.length} />
              {["ni", "lgd", "dea"].map((l) => (
                <FilterOption
                  key={l}
                  selected={level === l}
                  onClick={() => set({ level: level === l ? null : l })}
                  label={l === "ni" ? "Northern Ireland" : `${LEVELS[l].name}s`}
                  count={counts[l]}
                />
              ))}
            </FilterGroup>
            <FilterGroup title="Within council">
              {geo.lgds.map((lgd) => (
                <FilterOption
                  key={lgd.code}
                  selected={within === lgd.code}
                  onClick={() => set({ within: within === lgd.code ? null : lgd.code })}
                  label={lgd.name}
                />
              ))}
            </FilterGroup>
            <FilterGroup title="Topics">
              <p className="filters__hint">Show a topic's headline figure on every result.</p>
              {categories.map((c) => (
                <FilterOption
                  key={c.id}
                  selected={topic === c.id}
                  onClick={() => set({ topic: topic === c.id ? null : c.id })}
                  label={c.title}
                  icon={icons[c.icon]}
                />
              ))}
            </FilterGroup>
          </>
        )}
      </aside>

      <section className="results__main">
        {featured && <FeaturedProfile area={featured} geo={geo} />}

        <div className="results__bar">
          <h1>Profiles</h1>
          <span className="results__count">
            {results.length} {results.length === 1 ? "Profile" : "Profiles"}
            {q && <> matching “{q}”</>}
          </span>
          <span className="results__size">
            View:
            {SIZES.map((s) => (
              <button key={s} className={s === size ? "is-active" : undefined} onClick={() => set({ size: s === 10 ? null : s })}>
                {s}
              </button>
            ))}
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="page-message">No profiles match. Try a different name or clear the filters.</p>
        ) : (
          <ol className="result-list">
            {shown.map((area) => (
              <li key={area.code}>
                <a className="result" href={profileHref(area.code)}>
                  <span className="result__level">{LEVELS[area.level].name}</span>
                  <span className="result__name">{area.name}</span>
                  <span className="result__desc">{describeArea(area, geo)}</span>
                  {topic && <TopicValue topic={topic} area={area} geo={geo} />}
                </a>
              </li>
            ))}
          </ol>
        )}

        {pages > 1 && (
          <nav className="pager" aria-label="Pages">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} aria-current={p === page ? "page" : undefined} onClick={() => set({ page: p === 1 ? null : p })}>
                {p}
              </button>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}

function FilterGroup({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="filter-group">
      <button className="filter-group__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {title}
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && <ul>{children}</ul>}
    </div>
  );
}

function FilterOption({ selected, onClick, label, count, icon }) {
  return (
    <li>
      <button className={`filter-option ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={onClick}>
        {icon && <span className="filter-option__icon" dangerouslySetInnerHTML={{ __html: icon }} />}
        <span>{label}</span>
        {count != null && <span className="filter-option__count">{count}</span>}
      </button>
    </li>
  );
}

function FeaturedProfile({ area, geo }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    setStats(null);
    Promise.all(
      categories.map(async (c) => ({ category: c, highlight: await loadHighlight(c.id, area, geo).catch(() => null) }))
    ).then((all) => alive && setStats(all.filter((s) => s.highlight)));
    return () => {
      alive = false;
    };
  }, [area, geo]);

  return (
    <article className="featured">
      <OutlineMap area={area} geo={geo} className="featured__map" />
      <div className="featured__body">
        <span className="result__level">{LEVELS[area.level].name}</span>
        <h2>
          <a href={profileHref(area.code)}>{area.name}</a>
        </h2>
        <p>{describeArea(area, geo)}</p>
        <dl className="featured__stats">
          {stats
            ? stats.map(({ category, highlight }) => (
                <div key={category.id}>
                  <dt>{highlight.label}:</dt>
                  <dd>{highlight.value}</dd>
                </div>
              ))
            : Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer" />)}
        </dl>
        <a className="btn-outline" href={profileHref(area.code)}>
          View Profile
        </a>
      </div>
    </article>
  );
}

function TopicValue({ topic, area, geo }) {
  const [highlight, setHighlight] = useState(undefined);
  useEffect(() => {
    let alive = true;
    loadHighlight(topic, area, geo).then(
      (h) => alive && setHighlight(h),
      () => alive && setHighlight(null)
    );
    return () => {
      alive = false;
    };
  }, [topic, area, geo]);
  if (highlight === undefined) return <span className="result__stat shimmer-text">Loading…</span>;
  if (!highlight) return <span className="result__stat is-muted">Not available at this level</span>;
  return (
    <span className="result__stat">
      {highlight.label}: <strong>{highlight.value}</strong> <span className="is-muted">({highlight.period})</span>
    </span>
  );
}
