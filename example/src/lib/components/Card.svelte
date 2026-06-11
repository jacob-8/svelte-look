<script>
  let { title, description } = $props()
</script>

<div class="card">
  <h3 class="title">{title}</h3>
  {#if description}
    <p class="description">{description}</p>
  {/if}
</div>

<style>
  .card {
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--background);
    padding: 1rem;
  }

  .title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color);
    margin: 0 0 0.25rem;
  }

  .description {
    font-size: 0.875rem;
    color: var(--color-secondary);
    line-height: 1.625;
    margin: 0;
  }
</style>
