<script>
  let { title, description } = $props()
</script>

<div class="border border-[var(--border-color)] rounded-lg bg-[var(--background)] p-4">
  <h3 class="text-base font-semibold text-[var(--color)] mb-1">{title}</h3>
  {#if description}
    <p class="text-sm text-[var(--color-secondary)] leading-relaxed">{description}</p>
  {/if}
</div>
