<script>
  import { LEVELS, NI_CODE, ancestors, categories, describeArea, headlines, icons } from "@nisra-explorer/core";
  import SearchBox from "./SearchBox.svelte";
  import IndicatorCard from "./IndicatorCard.svelte";
  import MapSection from "./MapSection.svelte";

  let { geo, area, compare, select } = $props();

  let aboutOpen = $state(false);
  let copied = $state(false);

  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      window.prompt("Copy this link", location.href);
    }
  }
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="#/">Home</a>
  {#each ancestors(area) as a (a.code)}
    <span aria-hidden="true">›</span>
    <a href={`#/${a.code}`}>{a.name}</a>
  {/each}
</nav>

<div class="area-header">
  <h1>
    {area.name}
    <span class="area-header__level">{LEVELS[area.level].name}</span>
  </h1>
  <div class="area-header__tools">
    <SearchBox {geo} onSelect={select} />
    <div class="btn-row">
      <button class="btn" aria-expanded={aboutOpen} onclick={() => (aboutOpen = !aboutOpen)}>About</button>
      <button class="btn" onclick={() => window.print()}>Print / PDF</button>
      <button class="btn" onclick={share}>Share</button>
    </div>
    {#if copied}<span class="toast" role="status">Link copied to clipboard</span>{/if}
  </div>
</div>

{#if aboutOpen}
  <div class="card about-panel">
    <p>
      The Local Statistics Explorer brings together key statistics for Northern Ireland, its 11
      councils and 80 District Electoral Areas. Every figure is read live from the NISRA Data Portal;
      use the <b>i</b> button on any card for its definition and source table.
    </p>
    <p>
      Search by area name or BT postcode, click the map to move between areas, or pick another area
      of the same type to compare against.
    </p>
  </div>
{/if}

<!-- Re-create every card when the area or comparison changes so each reloads cleanly. -->
{#key `${area.code}:${compare?.code ?? ""}`}
  <div class="headline-grid">
    <div class="card about-card">
      <h2>About {area.name}</h2>
      <p>{describeArea(area, geo)}</p>
    </div>
    {#each headlines as indicator (indicator.id)}
      <IndicatorCard {indicator} {area} {compare} {geo} />
    {/each}
  </div>
{/key}

<MapSection {geo} {area} {compare} {select} />

{#key `${area.code}:${compare?.code ?? ""}`}
  {#each categories as category (category.id)}
    <details class="topic" open>
      <summary>
        <span class="topic__icon">{@html icons[category.icon]}</span>
        {category.title}
      </summary>
      <p class="topic__intro">
        {category.title} statistics for {area.name}{#if area.code !== NI_CODE}{" "}compared with
          <a href={`#/${NI_CODE}`}>Northern Ireland</a>{/if}{#if compare}{" "}and {compare.name}{/if}.
      </p>
      <div class="indicator-grid">
        {#each category.indicators as indicator (indicator.id)}
          <IndicatorCard {indicator} {area} {compare} {geo} />
        {/each}
      </div>
    </details>
  {/each}
{/key}
