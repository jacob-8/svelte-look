<script>
  let { label = 'Click me', variant = 'primary', onclick } = $props()
</script>

<button class={['btn', variant]} {onclick}>
  {label}
</button>

<style>
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
  }

  .primary {
    background: var(--primary);
    color: var(--on-primary);
  }

  .secondary {
    background: var(--surface);
    color: var(--color);
  }

  .danger {
    background: var(--danger);
    color: #ffffff;
  }
</style>
