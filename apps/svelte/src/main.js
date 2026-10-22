import { mount } from "svelte";
import "@esri/calcite-components/main.css";
import "@arcgis/map-components/main.css";
import "@nisra-explorer/core/styles.css";
import App from "./App.svelte";

export default mount(App, { target: document.getElementById("app") });
