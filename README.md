# NISRA Local Statistics Explorer — ArcGIS 5.x recreation

An unofficial recreation of the [NISRA Local Statistics Explorer](https://explore.nisra.gov.uk/local-stats/)
built twice on one shared core, with the ArcGIS Maps SDK for JavaScript 5.x:

| Package | What it is |
| --- | --- |
| `packages/core` | Framework-free logic: NISRA Data Portal (PxStat / JSON-stat) client, geography, every indicator definition, hash router, the ArcGIS map controller, and the shared stylesheet. |
| `apps/react` | React 19 front-end (port 5181). |
| `apps/svelte` | Svelte 5 (runes) front-end (port 5182). |

Both apps render the same `<arcgis-map>` web component and hand it to
`createExplorerMap()` in the core, so the map, data and styling are identical; only the
component layer differs.

## Commands

```bash
npm install
npm run dev:react     # http://localhost:5181
npm run dev:svelte    # http://localhost:5182
npm run build         # builds both into apps/*/dist (relative base, any static host)
```

## Data

- **Statistics** are fetched live in the browser from the
  [NISRA Data Portal](https://data.nisra.gov.uk/) API (`ws-data.nisra.gov.uk`, CORS-enabled, no key).
  Each table is fetched once per page load and cached. Indicators are declared in
  `packages/core/src/indicators.js`; each says which table holds the numbers at each geography level
  and whether missing areas can be summed from smaller ones (counts only).
- **Boundaries** are read live from DAERA's public
  [District Electoral Area feature service](https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/FarmCensusDistrictElectoralArea2019/FeatureServer)
  (OSNI 2012 DEAs, published with the Farm Census). The map shows it as a service-backed
  FeatureLayer; the app also queries it once at start-up (generalised, ~0.5 MB) for search, the
  landing silhouette and postcode lookup. Council polygons are built in the browser by unioning
  each council's DEAs. Official NISRA names come from the Data Portal. DAERA's layer has no code for
  Titanic DEA, which is filled in from the one NISRA code it doesn't match.
  OSNI's own boundary services can't be used from a public page: the open data server
  (`services.spatialni.gov.uk`) currently redirects to an "unavailable" holding page, and its ArcGIS
  Online proxies only accept OSNI's own apps. ArcGIS Living Atlas has no Northern Ireland council or
  DEA layers (only the six historic counties).
- **Basemap**: Esri's public light grey canvas tiles (no API key needed).
- **Postcode search** uses [postcodes.io](https://postcodes.io) to geocode a BT postcode, then finds
  the containing DEA with a point-in-polygon test.

## Differences from the original

- Covers Northern Ireland, councils and DEAs (not the smaller super data zones / data zones).
- About 30 indicators across the same seven topics; a few of the original's (e.g. trade partners,
  hospital admissions, dental registrations) are not included yet.
- Search covers area names and postcodes, not town names.
- Where a dataset has a newer release than the original site shows, this version shows the newer one.
