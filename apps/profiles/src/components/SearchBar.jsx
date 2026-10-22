import { useId, useMemo, useState } from "react";
import { LEVELS, findPostcode, looksLikePostcode, searchAreas } from "@nisra-explorer/core";
import { go, profileHref, searchHref } from "../router.js";

/** Census-style search: suggestions jump to a profile; Enter shows all matching profiles. */
export default function SearchBar({ geo }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState(null);
  const listId = useId();

  const results = useMemo(() => searchAreas(geo, query, 6), [geo, query]);

  function reset() {
    setQuery("");
    setOpen(false);
    setActive(-1);
    setMessage(null);
  }

  async function submit(event) {
    event.preventDefault();
    if (active >= 0 && results[active]) {
      go(profileHref(results[active].code));
      return reset();
    }
    if (looksLikePostcode(query)) {
      setOpen(true);
      setMessage("Looking up postcode…");
      try {
        const dea = await findPostcode(geo, query);
        if (!dea) return setMessage("That postcode wasn't found in Northern Ireland.");
        go(profileHref(dea.code));
        return reset();
      } catch {
        return setMessage("Postcode lookup is unavailable right now.");
      }
    }
    go(searchHref({ q: query.trim() }));
    reset();
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length > 1 && (results.length > 0 || message);

  return (
    <form className="searchbar" role="search" onSubmit={submit}>
      <svg className="searchbar__icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </svg>
      <input
        type="search"
        value={query}
        placeholder="Search for an area or a BT postcode"
        aria-label="Search for an area or postcode"
        role="combobox"
        aria-expanded={Boolean(showList)}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setMessage(null);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <button className="searchbar__go" type="submit" aria-label="Search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
      </button>
      {showList && (
        <ul className="searchbar__list" id={listId} role="listbox">
          {message ? (
            <li className="searchbar__message">{message}</li>
          ) : (
            results.map((area, i) => (
              <li key={area.code} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <a
                  href={profileHref(area.code)}
                  className={i === active ? "is-active" : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(profileHref(area.code));
                    reset();
                  }}
                >
                  <span className="searchbar__kind">Profile</span>
                  <span>{area.name}</span>
                  <span className="searchbar__level">
                    {area.level === "dea" ? `${LEVELS.dea.label}, ${area.parent.name}` : LEVELS[area.level].label}
                  </span>
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}
