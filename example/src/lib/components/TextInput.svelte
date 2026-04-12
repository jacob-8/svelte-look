<script>
  let { label = '', placeholder = '', value = $bindable('') } = $props()
  let focused = $state(false)
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <label class="text-sm font-medium text-[var(--color)]">{label}</label>
  {/if}
  <input
    type="text"
    {placeholder}
    bind:value
    onfocus={() => focused = true}
    onblur={() => focused = false}
    class="px-3 py-2 rounded-lg border text-sm text-[var(--color)] bg-[var(--background)] outline-none transition-colors"
    class:border-[var(--primary)]={focused}
    class:border-[var(--border-color)]={!focused}
  />
  {#if value}
    <p class="text-xs text-[var(--color-secondary)]">Characters: {value.length}</p>
  {/if}
</div>
