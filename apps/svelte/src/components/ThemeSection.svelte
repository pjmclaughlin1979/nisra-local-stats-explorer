<script>
  import { NI_CODE, icons } from "@nisra-explorer/core";
  import IndicatorCard from "./IndicatorCard.svelte";

  /** One collapsible theme. Its statistics are only fetched the first time it is opened. */
  let { category, open, onToggle, area, compare, geo } = $props();

  let visited = $state(false);
  let moreOpen = $state(false);
  const panelId = $derived(`theme-${category.id}`);

  $effect(() => {
    if (open) visited = true;
  });
</script>

<section class="theme">
  <h2 class="theme__heading">
    <button class="theme__toggle" aria-expanded={open} aria-controls={panelId} onclick={onToggle}>
      <span class="theme__icon">{@html icons[category.icon]}</span>
      {category.title}
      <svg class="theme__chevron" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  </h2>
  <div class="theme__panel" id={panelId} data-open={open ? "" : undefined} inert={!open}>
    <div class="theme__clip">
      {#if visited}
        <div class="theme__body">
          <p class="theme__intro">
            {category.title} statistics for {area.name}{#if area.code !== NI_CODE}{" "}compared with
              <a href={`#/${NI_CODE}`}>Northern Ireland</a>{/if}{#if compare}{" "}and {compare.name}{/if}.
          </p>
          <!-- Re-create the cards when the area or comparison changes so each reloads cleanly. -->
          {#key `${area.code}:${compare?.code ?? ""}`}
            <div class="indicator-grid">
              {#each category.indicators as indicator (indicator.id)}
                <IndicatorCard {indicator} {area} {compare} {geo} />
              {/each}
            </div>
          {/key}
          <div class="more">
            <h3>
              More {category.title.toLowerCase()} statistics
              <button class="more__toggle" aria-expanded={moreOpen} onclick={() => (moreOpen = !moreOpen)}>
                {moreOpen ? "− Click to hide" : "+ Click to expand"}
              </button>
            </h3>
            {#if moreOpen}
              <div class="more__body">
                <p>{category.more.summary}</p>
                <ul>
                  {#each category.more.links as link (link.url)}
                    <li><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>
