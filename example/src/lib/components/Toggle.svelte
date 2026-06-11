<script>
  let { label = '', initial = false } = $props()
  let checked = $state(initial)
</script>

<label class="toggle">
  <button
    role="switch"
    aria-checked={checked}
    class={['track', { checked }]}
    onclick={() => checked = !checked}
  >
    <span class="thumb"></span>
  </button>
  {#if label}
    <span class="label">{label}</span>
  {/if}
</label>

<style>
  .toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .track {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 1.5rem;
    width: 2.75rem;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    background: var(--surface);
    transition: background-color 0.15s;
  }

  .track.checked {
    background: var(--primary);
  }

  .thumb {
    display: inline-block;
    height: 1rem;
    width: 1rem;
    border-radius: 9999px;
    background: #ffffff;
    transform: translateX(0.25rem);
    transition: transform 0.15s;
  }

  .track.checked .thumb {
    transform: translateX(1.5rem);
  }

  .label {
    font-size: 0.875rem;
    color: var(--color);
  }
</style>
