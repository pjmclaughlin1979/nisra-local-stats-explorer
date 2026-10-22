import { useId, useMemo, useState } from "react";
import { LEVELS, findPostcode, looksLikePostcode, searchAreas } from "@nisra-explorer/core";

export default function SearchBox({ geo, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState(null);
  const listId = useId();

  const results = useMemo(() => searchAreas(geo, query), [geo, query]);

  function choose(area) {
    setQuery("");
    setOpen(false);
    setMessage(null);
    onSelect(area.code);
  }

  async function submit(event) {
    event.preventDefault();
    if (looksLikePostcode(query)) {
      setOpen(true);
      setMessage("Looking up postcode…");
      try {
        const dea = await findPostcode(geo, query);
        if (dea) choose(dea);
        else setMessage("That postcode wasn't found in Northern Ireland.");
      } catch {
        setMessage("Postcode lookup is unavailable right now.");
      }
      return;
    }
    if (results[active]) choose(results[active]);
    else {
      setOpen(true);
      setMessage("No matching areas. Try a council, electoral area or BT postcode.");
    }
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && (results.length > 0 || message);

  return (
    <form className="search" role="search" onSubmit={submit}>
      <input
        type="search"
        value={query}
        placeholder="Enter a postcode or area name"
        aria-label="Search for an area or postcode"
        role="combobox"
        aria-expanded={Boolean(showList)}
        aria-controls={listId}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setMessage(null);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <button className="search__btn" type="submit" aria-label="Search">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
      </button>
      {showList && (
        <ul className="search__results" id={listId} role="listbox">
          {message ? (
            <li className="search__message">{message}</li>
          ) : (
            results.map((area, i) => (
              <li key={area.code} role="option" aria-selected={i === active}>
                <button type="button" aria-selected={i === active} onMouseDown={() => choose(area)}>
                  <span>{area.name}</span>
                  <span className="search__level">
                    {area.level === "dea" ? `${LEVELS.dea.label}, ${area.parent.name}` : LEVELS[area.level].label}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}
