<script>
  let count = $state(0)
</script>

<div class="counter">
  <button class="btn decrement" onclick={() => count--}>
    −
  </button>
  <span class="value">{count}</span>
  <button class="btn increment" onclick={() => count++}>
    +
  </button>
</div>

<style>
  .counter {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
  }

  .btn {
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-weight: 700;
    font-size: 1.125rem;
    border: none;
    cursor: pointer;
  }

  .decrement {
    background: var(--surface);
    color: var(--color);
  }

  .increment {
    background: var(--primary);
    color: var(--on-primary);
  }

  .value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color);
    min-width: 2rem;
    text-align: center;
  }
</style>
