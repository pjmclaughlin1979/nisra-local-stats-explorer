<script>
  import { createRouter, loadGeography } from "@nisra-explorer/core";
  import Header from "./components/Header.svelte";
  import Footer from "./components/Footer.svelte";
  import Landing from "./components/Landing.svelte";
  import AreaPage from "./components/AreaPage.svelte";

  const router = createRouter();
  let route = $state(router.get());
  router.subscribe((next) => (route = next));

  let geo = $state(null);
  let error = $state(null);
  loadGeography().then(
    (g) => (geo = g),
    (e) => (error = e)
  );

  const area = $derived(geo && route.code ? geo.get(route.code) : null);
  const compare = $derived(geo && route.compare ? geo.get(route.compare) : null);

  // Navigates to an area, keeping the current comparison only if it is the same kind of area.
  // Pass { keepScroll: true } when navigating from the map so the page doesn't jump to the top.
  function select(code, compareCode = route.compare, options) {
    const next = geo?.get(code);
    const other = compareCode && geo?.get(compareCode);
    const keep = next && other && other.level === next.level && other.code !== next.code;
    router.go(code, keep ? other.code : null, options);
  }
</script>

<Header />
<main class="container">
  {#if error}
    <p class="error">Could not load the area boundaries: {error.message}</p>
  {:else if !geo}
    <p class="loading" role="status">Loading area boundaries from DAERA…</p>
  {:else if area}
    <AreaPage {geo} {area} {compare} {select} />
  {:else}
    <Landing {geo} {select} />
  {/if}
</main>
<Footer />
