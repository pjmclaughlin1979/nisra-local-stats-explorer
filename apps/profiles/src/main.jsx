import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@esri/calcite-components/main.css";
import "@arcgis/map-components/main.css";
import "./styles.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
