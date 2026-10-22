import { Fragment, useEffect, useState } from "react";
import { LEVELS, ancestors, categories, describeArea, fmt, icons } from "@nisra-explorer/core";
import { go, profileHref } from "../router.js";
import { loadHighlight } from "../models.js";
import OutlineMap from "./OutlineMap.jsx";
import TopicSection from "./TopicSection.jsx";
import ReferenceMap from "./ReferenceMap.jsx";
import Source from "./Source.jsx";

export default function ProfilePage({ geo, area, topic }) {
  const [showSources, setShowSources] = useState(true);
  const [activeTopic, setActiveTopic] = useState(categories[0].id);
  const [toast, setToast] = useState(null);

  // Open on the topic named in the link (?topic=…), as a shared section link does.
  useEffect(() => {
    if (!topic) return;
    const id = setTimeout(() => document.getElementById(`topic-${topic}`)?.scrollIntoView({ behavior: "smooth" }), 300);
    return () => clearTimeout(id);
  }, [area, topic]);

  // Scrollspy: highlight the chip for the topic section nearest the top of the viewport.
  useEffect(() => {
    const sections = categories.map((c) => document.getElementById(`topic-${c.id}`)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveTopic(visible[0].target.id.replace("topic-", ""));
      },
      { rootMargin: "-140px 0px -55% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [area]);

  async function share(params) {
    const url = new URL(profileHref(area.code, params), location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied to clipboard");
    } catch {
      window.prompt("Copy this link", url);
    }
    setTimeout(() => setToast(null), 2200);
  }

  function jumpTo(id) {
    go(profileHref(area.code, { topic: id }));
    document.getElementById(`topic-${id}`)?.scrollIntoView({ behavior: "smooth" });
  }

  const nearby =
    area.level === "ni" ? geo.lgds : area.level === "lgd" ? geo.lgds.filter((a) => a !== area) : area.parent.children.filter((a) => a !== area);
  const nearbyTitle =
    area.level === "ni" ? "Councils in Northern Ireland" : area.level === "lgd" ? "Other councils" : `Other electoral areas in ${area.parent.name}`;

  return (
    <div className={`profile ${showSources ? "" : "hide-sources"}`}>
      <section className="hero">
        <OutlineMap area={area} geo={geo} className="hero__map" />
        <div className="hero__text">
          <span className="hero__level">{LEVELS[area.level].name}</span>
          <h1>{area.name}</h1>
          <p>
            {describeArea(area, geo)} It covers {fmt.number(area.areaKm2, 1)} square kilometres.
            {area.level !== "ni" && (
              <>
                {" "}It is part of{" "}
                {ancestors(area)
                  .reverse()
                  .map((a, i) => (
                    <Fragment key={a.code}>
                      {i > 0 && " in "}
                      <a href={profileHref(a.code)}>{a.name}</a>
                    </Fragment>
                  ))}
                .
              </>
            )}
          </p>
          <button className="btn-outline" onClick={() => share()}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 5h5v5M19 5l-8 8M10 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4" /></svg>
            Share Profile
          </button>
        </div>
      </section>

      <div className="crumbs">
        <nav aria-label="Breadcrumb">
          <span aria-hidden="true">//</span>
          {[...ancestors(area), area].map((a, i, all) => (
            <Fragment key={a.code}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {i < all.length - 1 ? <a href={profileHref(a.code)}>{a.name}</a> : <span aria-current="page">{a.name}</span>}
            </Fragment>
          ))}
        </nav>
        <label className="toggle">
          <input type="checkbox" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} />
          <span className="toggle__track" aria-hidden="true" />
          Display Sources
        </label>
      </div>

      <Highlights area={area} geo={geo} onJump={jumpTo} />

      <nav className="chips" aria-label="Topics">
        {categories.map((c) => (
          <button key={c.id} className={c.id === activeTopic ? "is-active" : undefined} onClick={() => jumpTo(c.id)}>
            <span className="chips__icon" dangerouslySetInnerHTML={{ __html: icons[c.icon] }} />
            {c.title}
          </button>
        ))}
      </nav>

      <div className="profile__body">
        <div className="profile__sections">
          {categories.map((category) => (
            <TopicSection key={category.id} category={category} area={area} geo={geo} onShare={(params) => share(params)} />
          ))}
          <section className="nearby">
            <h2>{nearbyTitle}</h2>
            <ul>
              {nearby.map((a) => (
                <li key={a.code}>
                  <a href={profileHref(a.code)}>
                    <span className="result__level">{LEVELS[a.level].name}</span>
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="profile__map">
          <h2>{area.name} Reference Map</h2>
          <ReferenceMap area={area} geo={geo} />
          <p className="profile__map-hint">Click an area on the map to open its profile.</p>
        </aside>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function Highlights({ area, geo, onJump }) {
  const [items, setItems] = useState({});

  useEffect(() => {
    let alive = true;
    setItems({});
    for (const c of categories) {
      loadHighlight(c.id, area, geo).then(
        (h) => alive && setItems((all) => ({ ...all, [c.id]: h })),
        () => alive && setItems((all) => ({ ...all, [c.id]: null }))
      );
    }
    return () => {
      alive = false;
    };
  }, [area, geo]);

  return (
    <section className="highlights" aria-label="Highlights">
      {categories.map((c) => {
        const h = items[c.id];
        return (
          <div className="highlight" key={c.id}>
            <span className="highlight__icon" dangerouslySetInnerHTML={{ __html: icons[c.icon] }} />
            <div>
              <button className="highlight__topic" onClick={() => onJump(c.id)}>
                {c.title}
              </button>
              {h === undefined ? (
                <div className="shimmer" />
              ) : h === null ? (
                <div className="highlight__label is-muted">Not available for {LEVELS[area.level].plural}</div>
              ) : (
                <>
                  <div className="highlight__label">{h.label}</div>
                  <div className="highlight__value">{h.value}</div>
                  <Source tables={h.tables} period={h.period} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
