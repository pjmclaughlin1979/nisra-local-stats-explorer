import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createRouter, loadGeography } from "@nisra-explorer/core";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Landing from "./components/Landing.jsx";
import AreaPage from "./components/AreaPage.jsx";

const router = createRouter();

export default function App() {
  const route = useSyncExternalStore(router.subscribe, router.get);
  const [geo, setGeo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGeography().then(setGeo, setError);
  }, []);

  const area = geo && route.code ? geo.get(route.code) : null;
  const compare = geo && route.compare ? geo.get(route.compare) : null;

  // Navigates to an area, keeping the current comparison only if it is the same kind of area.
  // Pass { keepScroll: true } when navigating from the map so the page doesn't jump to the top.
  const select = useCallback(
    (code, compareCode = route.compare, options) => {
      const next = geo?.get(code);
      const other = compareCode && geo?.get(compareCode);
      const keep = next && other && other.level === next.level && other.code !== next.code;
      router.go(code, keep ? other.code : null, options);
    },
    [geo, route.compare]
  );

  return (
    <>
      <Header />
      <main className="container">
        {error ? (
          <p className="error">Could not load the area boundaries: {error.message}</p>
        ) : !geo ? (
          <p className="loading" role="status">Loading area boundaries from DAERA…</p>
        ) : area ? (
          <AreaPage geo={geo} area={area} compare={compare} select={select} />
        ) : (
          <Landing geo={geo} select={select} />
        )}
      </main>
      <Footer />
    </>
  );
}
