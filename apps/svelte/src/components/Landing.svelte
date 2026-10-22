<script>
  import { NI_CODE, councilPaths } from "@nisra-explorer/core";
  import SearchBox from "./SearchBox.svelte";

  let { geo, select } = $props();

  const outline = $derived(councilPaths(geo));
</script>

<div class="landing">
  <section class="card">
    <h2>Explore key statistics for any area in Northern Ireland</h2>
    <SearchBox {geo} onSelect={select} />
    <h2>Or select your council area</h2>
    <div class="link-list">
      {#each geo.lgds as area (area.code)}
        <a href={`#/${area.code}`}>{area.name}</a>
      {/each}
    </div>
  </section>
  <section class="card">
    <h2>Click on the map to view Northern Ireland as a whole</h2>
    <a class="ni-link" href={`#/${NI_CODE}`} aria-label="View Northern Ireland as a whole">
      <svg class="ni-svg" viewBox={outline.viewBox} role="img" aria-hidden="true">
        {#each outline.paths as { area, d } (area.code)}
          <path {d} />
        {/each}
      </svg>
    </a>
  </section>
</div>
