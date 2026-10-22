<script>
  import "@arcgis/map-components/components/arcgis-map";
  import "@arcgis/map-components/components/arcgis-zoom";
  import { LEVELS, ancestors } from "@nisra-explorer/core";
  import { createExplorerMap } from "@nisra-explorer/core/map";

  let { geo, area, compare, select } = $props();

  // Everything chosen from the map section keeps the page scrolled to the map, so the zoom is visible.
  const STAY = { keepScroll: true };
  const stay = (code) => (event) => {
    event.preventDefault();
    select(code, undefined, STAY);
  };

  let mapEl;
  let controller = $state(null);

  // One controller per <arcgis-map> element; the element tears down its own view on unmount.
  $effect(() => {
    createExplorerMap(mapEl, { onSelect: (code) => select(code, undefined, STAY) }).then((c) => (controller = c));
  });

  $effect(() => {
    controller?.show({ area, compare });
  });

  const larger = $derived(ancestors(area));
  const childLevel = $derived(area.level === "ni" ? "lgd" : area.level === "lgd" ? "dea" : null);
  const peers = $derived(area.level === "ni" ? [] : geo.atLevel(area.level).filter((a) => a !== area));
</script>

<section class="map-section">
  <h2>
    You are currently viewing <span>{area.name}</span>{#if area.level !== "ni"}{" "}{LEVELS[area.level].label.toLowerCase()}{/if}
  </h2>
  <p class="hint">Zoom and click on the map to explore other areas</p>
  <div class="map-layout">
    <div class="map-frame">
      <arcgis-map bind:this={mapEl}>
        <arcgis-zoom slot="top-left"></arcgis-zoom>
      </arcgis-map>
    </div>
    <aside class="map-side">
      {#if larger.length}
        <section>
          <h3>Select a larger area containing {area.name}</h3>
          <div class="link-list">
            {#each larger as a (a.code)}<a href={`#/${a.code}`} onclick={stay(a.code)}>{a.name}</a>{/each}
          </div>
        </section>
      {/if}
      {#if childLevel}
        <section>
          <h3>Select {childLevel === "lgd" ? "a council" : "an electoral area"} within {area.name}</h3>
          <div class="link-list">
            {#each area.children as a (a.code)}<a href={`#/${a.code}`} onclick={stay(a.code)}>{a.name}</a>{/each}
          </div>
        </section>
      {/if}
      {#if area.level === "dea"}
        <section>
          <h3>Other electoral areas in {area.parent.name}</h3>
          <div class="link-list">
            {#each area.parent.children.filter((a) => a !== area) as a (a.code)}
              <a href={`#/${a.code}`} onclick={stay(a.code)}>{a.name}</a>
            {/each}
          </div>
        </section>
      {/if}
      {#if peers.length}
        <section>
          <h3>Compare with another {LEVELS[area.level].singular}</h3>
          <select
            aria-label={`Compare with another ${LEVELS[area.level].singular}`}
            value={compare?.code ?? ""}
            onchange={(e) => select(area.code, e.currentTarget.value || null, STAY)}
          >
            <option value="">Choose an area…</option>
            {#if area.level === "dea"}
              {#each geo.lgds as lgd (lgd.code)}
                <optgroup label={lgd.name}>
                  {#each lgd.children.filter((a) => a !== area) as a (a.code)}
                    <option value={a.code}>{a.name}</option>
                  {/each}
                </optgroup>
              {/each}
            {:else}
              {#each peers as a (a.code)}
                <option value={a.code}>{a.name}</option>
              {/each}
            {/if}
          </select>
          {#if compare}
            <div>
              <span class="compare-key"><span class="swatch swatch--area"></span> {area.name}</span>
              <span class="compare-key"><span class="swatch swatch--compare"></span> {compare.name}</span>
            </div>
            <button class="btn btn--ghost" style="margin-top: 8px" onclick={() => select(area.code, null, STAY)}>
              Clear comparison
            </button>
          {/if}
        </section>
      {/if}
    </aside>
  </div>
</section>
