# NISRA Local Statistics Explorer — ArcGIS 5.x recreation

An unofficial recreation of the [NISRA Local Statistics Explorer](https://explore.nisra.gov.uk/local-stats/)
built twice on one shared core, with the ArcGIS Maps SDK for JavaScript 5.x:

| Package | What it is |
| --- | --- |
| `packages/core` | Framework-free logic: NISRA Data Portal (PxStat / JSON-stat) client, geography, every indicator definition, hash router, the ArcGIS map controller, and the shared stylesheet. |
| `apps/react` | React 19 front-end (port 5181). |
| `apps/svelte` | Svelte 5 (runes) front-end (port 5182). |
| `apps/profiles` | React "statistics profiles" site (port 5183): the same data as searchable area profiles, laid out like data.census.gov/profile — search results with filters, then per-area profiles with headline stats, topic sections, charts with table views and a sticky reference map. |

**Live:** https://pjmclaughlin1979.github.io/nisra-local-stats-explorer/ ·
[React](https://pjmclaughlin1979.github.io/nisra-local-stats-explorer/react/) ·
[Svelte](https://pjmclaughlin1979.github.io/nisra-local-stats-explorer/svelte/) ·
[Profiles](https://pjmclaughlin1979.github.io/nisra-local-stats-explorer/profiles/)

Both apps render the same `<arcgis-map>` web component and hand it to
`createExplorerMap()` in the core, so the map, data and styling are identical; only the
component layer differs.

## Commands

```bash
npm install
npm run dev:react     # http://localhost:5181
npm run dev:svelte    # http://localhost:5182
npm run dev:profiles  # http://localhost:5183
npm run build         # builds all three into apps/*/dist (relative base, any static host)
```

Pushing to `main` runs `.github/workflows/pages.yml`, which builds all three apps and publishes them to
GitHub Pages under `/react/`, `/svelte/` and `/profiles/`, with `site/index.html` as the landing page.

## Data

- **Statistics** are fetched live in the browser from the
  [NISRA Data Portal](https://data.nisra.gov.uk/) API (`ws-data.nisra.gov.uk`, CORS-enabled, no key).
  Each table is fetched once per page load and cached. Indicators are declared in
  `packages/core/src/indicators.js`; each says which table holds the numbers at each geography level
  and whether missing areas can be summed from smaller ones (counts only).
- **Boundaries** are read live from two official feature services, both shown on the map as
  service-backed FeatureLayers:
  - **Councils**: the ONS
    [Local Authority Districts (May 2026) Boundaries UK BGC](https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_May_2026_Boundaries_UK_BGC/FeatureServer)
    layer (marked authoritative on ArcGIS Online), filtered to `LAD26CD LIKE 'N09%'`. Its codes are
    the council codes NISRA uses. Generalised and clipped to the coastline.
  - **District Electoral Areas**: DAERA's public
    [DEA feature service](https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/FarmCensusDistrictElectoralArea2019/FeatureServer)
    (OSNI 2012 DEAs, published with the Farm Census), filtered to the selected council via the
    council number embedded in each DEA code. The app also queries it once at start-up
    (generalised, ~0.5 MB) for search, the landing silhouette and postcode lookup. DAERA's layer has
    no code for Titanic DEA, which is filled in from the one NISRA code it doesn't match.

  Official NISRA names come from the Data Portal. OSNI's own boundary services can't be used from
  a public page: the open data server (`services.spatialni.gov.uk`) currently redirects to an
  "unavailable" holding page, and its ArcGIS Online proxies only accept OSNI's own apps. ArcGIS
  Living Atlas has no Northern Ireland council or DEA layers (only the six historic counties).
- **Basemap**: Esri's public light grey canvas tiles (no API key needed).
- **Postcode search** uses [postcodes.io](https://postcodes.io) to geocode a BT postcode, then finds
  the containing DEA with a point-in-polygon test.

## Differences from the original

- Covers Northern Ireland, councils and DEAs (not the smaller super data zones / data zones).
- About 30 indicators across the same seven topics; a few of the original's (e.g. trade partners,
  hospital admissions, dental registrations) are not included yet.
- Search covers area names and postcodes, not town names.
- Where a dataset has a newer release than the original site shows, this version shows the newer one.
