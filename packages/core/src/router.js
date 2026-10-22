// Hash routing (#/N09000003?compare=N09000007) so both builds work on any static host.

function parse() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  return { code: path || null, compare: new URLSearchParams(query).get("compare") };
}

export function createRouter() {
  let state = parse();
  const listeners = new Set();
  window.addEventListener("hashchange", () => {
    state = parse();
    listeners.forEach((fn) => fn(state));
    window.scrollTo({ top: 0 });
  });
  return {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    go(code, compare = null) {
      location.hash = code ? `/${code}${compare ? `?compare=${compare}` : ""}` : "/";
    },
  };
}
