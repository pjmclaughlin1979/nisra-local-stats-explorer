// Hash routing (#/N09000003?compare=N09000007) so both builds work on any static host.

function parse() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  return { code: path || null, compare: new URLSearchParams(query).get("compare") };
}

export function createRouter() {
  let state = parse();
  let keepScroll = false;
  const listeners = new Set();
  window.addEventListener("hashchange", () => {
    state = parse();
    listeners.forEach((fn) => fn(state));
    // Ordinary links start the new page at the top; navigation from the map stays put.
    if (!keepScroll) window.scrollTo({ top: 0 });
    keepScroll = false;
  });
  return {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** `keepScroll` leaves the page where it is, e.g. when the user picked an area on the map. */
    go(code, compare = null, { keepScroll: keep = false } = {}) {
      const hash = code ? `/${code}${compare ? `?compare=${compare}` : ""}` : "/";
      if (location.hash === `#${hash}`) return;
      keepScroll = keep;
      location.hash = hash;
    },
  };
}
