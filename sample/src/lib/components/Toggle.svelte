<script>
  let { label = '', initial = false } = $props()
  let checked = $state(initial)
</script>

<label class="flex items-center gap-2 cursor-pointer select-none">
  <button
    role="switch"
    aria-checked={checked}
    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
    class:bg-[var(--primary)]={checked}
    class:bg-[var(--surface)]={!checked}
    onclick={() => checked = !checked}
  >
    <span
      class="inline-block h-4 w-4 rounded-full bg-white transition-transform"
      class:translate-x-6={checked}
      class:translate-x-1={!checked}
    ></span>
  </button>
  {#if label}
    <span class="text-sm text-[var(--color)]">{label}</span>
  {/if}
</label>
