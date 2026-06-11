<script>
  let { title, body, footer } = $props()
</script>

<div class="card">
  <h3 class="card-title">{title}</h3>
  {#if body}
    <p class="card-body">{body}</p>
  {/if}
  {#if footer}
    <div class="card-footer">{footer}</div>
  {/if}
</div>

<style>
  .card {
    border: 2px solid var(--border-color, #d0d0d8);
    border-radius: 0.75rem;
    background: var(--surface, #f4f4f6);
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--primary, #3b6cf6);
  }

  .card-body {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color, #1a1a1f);
  }

  .card-footer {
    margin-top: 0.25rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color, #d0d0d8);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-secondary, #6b6b76);
  }
</style>
