<script>
  let { tabs = [], initial_tab = 0 } = $props()
  let active_index = $state(initial_tab)
</script>

<div>
  <div class="tab-list">
    {#each tabs as tab, index}
      <button
        class={['tab', { active: active_index === index }]}
        onclick={() => active_index = index}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="panel">
    {tabs[active_index]?.content ?? ''}
  </div>
</div>

<style>
  .tab-list {
    display: flex;
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    color: var(--color-secondary);
    transition: color 0.15s, border-color 0.15s;
  }

  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .panel {
    padding: 1rem;
    font-size: 0.875rem;
    color: var(--color);
  }
</style>
