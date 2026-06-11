<script>
  let { message, type = 'info', dismissible = false } = $props()
</script>

<div class={['alert', type]}>
  <span class="message">{message}</span>
  {#if dismissible}
    <button class="dismiss">×</button>
  {/if}
</div>

<style>
  .alert {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .message {
    flex: 1;
  }

  .dismiss {
    font-weight: 700;
    opacity: 0.5;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
  }

  .dismiss:hover {
    opacity: 1;
  }

  .info {
    background: #eff6ff;
    color: #1e40af;
  }

  .error {
    background: #fef2f2;
    color: #991b1b;
  }

  .success {
    background: #f0fdf4;
    color: #166534;
  }

  .warning {
    background: #fefce8;
    color: #854d0e;
  }
</style>
