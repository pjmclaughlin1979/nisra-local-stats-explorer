<script>
  import { LEVELS, findPostcode, looksLikePostcode, searchAreas } from "@nisra-explorer/core";

  let { geo, onSelect } = $props();

  let query = $state("");
  let open = $state(false);
  let active = $state(0);
  let message = $state(null);
  const listId = `search-${Math.random().toString(36).slice(2)}`;

  const results = $derived(searchAreas(geo, query));
  const showList = $derived(open && (results.length > 0 || message));

  function choose(area) {
    query = "";
    open = false;
    message = null;
    onSelect(area.code);
  }

  async function submit(event) {
    event.preventDefault();
    if (looksLikePostcode(query)) {
      open = true;
      message = "Looking up postcode…";
      try {
        const dea = await findPostcode(geo, query);
        if (dea) choose(dea);
        else message = "That postcode wasn't found in Northern Ireland.";
      } catch {
        message = "Postcode lookup is unavailable right now.";
      }
      return;
    }
    if (results[active]) choose(results[active]);
    else {
      open = true;
      message = "No matching areas. Try a council, electoral area or BT postcode.";
    }
  }

  function onkeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open = true;
      active = Math.min(active + 1, results.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (event.key === "Escape") {
      open = false;
    }
  }
</script>

<form class="search" role="search" onsubmit={submit}>
  <input
    type="search"
    bind:value={query}
    placeholder="Enter a postcode or area name"
    aria-label="Search for an area or postcode"
    role="combobox"
    aria-expanded={Boolean(showList)}
    aria-controls={listId}
    autocomplete="off"
    oninput={() => {
      active = 0;
      message = null;
      open = true;
    }}
    {onkeydown}
    onblur={() => setTimeout(() => (open = false), 150)}
  />
  <button class="search__btn" type="submit" aria-label="Search">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  </button>
  {#if showList}
    <ul class="search__results" id={listId} role="listbox">
      {#if message}
        <li class="search__message">{message}</li>
      {:else}
        {#each results as area, i (area.code)}
          <li role="option" aria-selected={i === active}>
            <button type="button" aria-selected={i === active} onmousedown={() => choose(area)}>
              <span>{area.name}</span>
              <span class="search__level">
                {area.level === "dea" ? `${LEVELS.dea.label}, ${area.parent.name}` : LEVELS[area.level].label}
              </span>
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</form>
