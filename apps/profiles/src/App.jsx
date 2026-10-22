import { useEffect, useState } from "react";
import { loadGeography } from "@nisra-explorer/core";
import { useRoute } from "./router.js";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import ResultsPage from "./components/ResultsPage.jsx";
import ProfilePage from "./components/ProfilePage.jsx";

export default function App() {
  const route = useRoute();
  const [geo, setGeo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGeography().then(setGeo, setError);
  }, []);

  const area = geo && route.page === "profile" ? geo.get(route.code) : null;

  useEffect(() => {
    document.title = area ? `${area.name} - NI Statistics Profile` : "NI Statistics Profiles";
  }, [area]);

  return (
    <>
      <Header geo={geo} />
      <main id="main">
        {error ? (
          <p className="page-message error">Could not load the area boundaries: {error.message}</p>
        ) : !geo ? (
          <p className="page-message" role="status">Loading areas…</p>
        ) : area ? (
          <ProfilePage geo={geo} area={area} topic={route.params.topic} />
        ) : (
          <ResultsPage geo={geo} params={route.page === "search" ? route.params : {}} />
        )}
      </main>
      <Footer />
    </>
  );
}
