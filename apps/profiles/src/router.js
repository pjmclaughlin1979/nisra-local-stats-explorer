import { useSyncExternalStore } from "react";

// Hash routes, so the build works on any static host:
//   #/?q=bel&level=dea&within=N09000003&page=2   search results
//   #/profile/N09000003?topic=health              a profile, optionally scrolled to a topic

function parse() {
  const [path, query = ""] = location.hash.replace(/^#/, "").split("?");
  const params = Object.fromEntries(new URLSearchParams(query));
  const match = path.match(/^\/profile\/([^/]+)/);
  return match ? { page: "profile", code: match[1], params } : { page: "search", params };
}

let route = parse();
const listeners = new Set();
window.addEventListener("hashchange", () => {
  const previous = route;
  route = parse();
  // A new profile or search starts at the top; changing topic within a profile doesn't.
  if (route.page !== previous.page || route.code !== previous.code) window.scrollTo({ top: 0 });
  listeners.forEach((fn) => fn());
});

export function useRoute() {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => route
  );
}

const withQuery = (path, params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
  return `#${path}${query ? `?${query}` : ""}`;
};

export const profileHref = (code, params) => withQuery(`/profile/${code}`, params);
export const searchHref = (params) => withQuery("/", params);
export const go = (href) => (location.hash = href.slice(1));
