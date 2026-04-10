<script>
  let { tabs = [], initial_tab = 0 } = $props()
  let active_index = $state(initial_tab)
</script>

<div>
  <div class="flex border-b border-[var(--border-color)]">
    {#each tabs as tab, index}
      <button
        class="px-4 py-2 text-sm font-medium transition-colors -mb-px"
        class:text-[var(--primary)]={active_index === index}
        class:border-b-2={active_index === index}
        class:border-[var(--primary)]={active_index === index}
        class:text-[var(--color-secondary)]={active_index !== index}
        onclick={() => active_index = index}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="p-4 text-sm text-[var(--color)]">
    {tabs[active_index]?.content ?? ''}
  </div>
</div>
