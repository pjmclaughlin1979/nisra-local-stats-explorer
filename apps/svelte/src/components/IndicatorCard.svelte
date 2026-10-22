<script>
  import { fmt, runIndicator } from "@nisra-explorer/core";

  let { indicator, area, compare, geo } = $props();

  let infoOpen = $state(false);
  const promise = $derived(runIndicator(indicator, { area, compare, geo }));

  const maxOf = (model) =>
    Math.max(1, ...model.rows.flatMap((r) => r.values.filter((v) => v != null)));
</script>

<article class="card indicator">
  <header class="indicator__head">
    <h3>{indicator.title}</h3>
    <button
      class="info-toggle"
      aria-expanded={infoOpen}
      aria-label={`About ${indicator.title}`}
      onclick={() => (infoOpen = !infoOpen)}
    >
      i
    </button>
  </header>

  {#if infoOpen}
    <div class="indicator__info">
      <p>{indicator.description}</p>
      {#await promise then model}
        {#if model.tables?.length}
          <ul>
            {#each model.tables as t (t.matrix)}
              <li>
                Access data at: <a href={t.url} target="_blank" rel="noreferrer">{t.label}</a>
                {#if t.updated}(updated {t.updated}){/if}
              </li>
            {/each}
          </ul>
        {/if}
      {/await}
    </div>
  {/if}

  {#await promise}
    <div class="skeleton"></div>
  {:then model}
    {#if model.kind === "unavailable"}
      <p class="unavailable">{model.message}</p>
    {:else}
      <p class="indicator__period">{model.period}</p>

      {#if model.kind === "headline"}
        <div>
          <span class="headline__value">{model.value}</span>
          {#if model.unit}<span class="headline__unit">{model.unit}</span>{/if}
        </div>
        <ul class="headline__lines">
          {#each model.lines as line}
            <li>
              {line.text ?? ""}
              {#if line.badge}<span class="badge">{line.badge}</span>{/if}
              {line.after ?? ""}
            </li>
          {/each}
        </ul>
        {#if model.change}
          <span class={`change change--${model.change.direction}`}>
            {model.change.direction === "up" ? "▲ Up" : "▼ Down"}
            {model.change.text}
          </span>
        {/if}
        {#each model.comparisons as c (c.name)}
          <p class="comparisons">Compared with <b>{c.name}</b>: {c.value}</p>
        {/each}
      {:else if model.kind === "bars"}
        {@const max = maxOf(model)}
        <div class="legend">
          {#each model.series as s (s.code)}
            <span class="legend__item"><span class={`swatch swatch--${s.role}`}></span>{s.name}</span>
          {/each}
        </div>
        {#each model.rows as row (row.label)}
          <div class="bar-row">
            <div class="bar-row__label">{row.label}</div>
            {#each row.values as v, i (model.series[i].code)}
              <div class="bar" title={`${model.series[i].name}: ${fmt.percent(v)}`}>
                <div
                  class={`bar__fill bar__fill--${model.series[i].role}`}
                  style:width={`${((v ?? 0) / max) * 85}%`}
                ></div>
                <span class="bar__value">{fmt.barLabel(v)}</span>
              </div>
            {/each}
          </div>
        {/each}
      {:else if model.kind === "figures"}
        <dl class="figures">
          {#each model.items as item (item.label)}
            <div class="figure">
              <dt>{item.label}</dt>
              <dd class="figure__value">{item.value}</dd>
              {#if item.detail}<dd class="figure__detail">{item.detail}</dd>{/if}
              {#if item.comparisons.length}
                <dd class="figure__compare">
                  {#each item.comparisons as c (c.name)}
                    <span>{c.name} {c.value}</span>
                  {/each}
                </dd>
              {/if}
            </div>
          {/each}
        </dl>
      {/if}
    {/if}
  {:catch error}
    <p class="error">Couldn't load this statistic: {error.message}</p>
  {/await}
</article>
