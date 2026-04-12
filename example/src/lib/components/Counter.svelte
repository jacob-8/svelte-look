<script>
  let count = $state(0)
</script>

<div class="flex items-center gap-3 p-4">
  <button
    class="px-3 py-1 rounded bg-[var(--surface)] text-[var(--color)] font-bold text-lg"
    onclick={() => count--}
  >
    −
  </button>
  <span class="text-xl font-semibold text-[var(--color)] min-w-8 text-center">{count}</span>
  <button
    class="px-3 py-1 rounded bg-[var(--primary)] text-[var(--on-primary)] font-bold text-lg"
    onclick={() => count++}
  >
    +
  </button>
</div>
