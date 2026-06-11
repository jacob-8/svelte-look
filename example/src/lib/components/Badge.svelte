<script>
  let { text, color = 'default' } = $props()
</script>

<span class={['badge', color]}>
  {text}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .default {
    background: var(--surface);
    color: var(--color);
  }

  .success {
    background: #dcfce7;
    color: #166534;
  }

  .error {
    background: #fee2e2;
    color: #991b1b;
  }

  .warning {
    background: #fef9c3;
    color: #854d0e;
  }

  .info {
    background: #dbeafe;
    color: #1e40af;
  }
</style>
