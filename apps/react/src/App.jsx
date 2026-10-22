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
  const select = useCallback(
    (code, compareCode = route.compare) => {
      const next = geo?.get(code);
      const other = compareCode && geo?.get(compareCode);
      const keep = next && other && other.level === next.level && other.code !== next.code;
      router.go(code, keep ? other.code : null);
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
          <div className="skeleton" />
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
