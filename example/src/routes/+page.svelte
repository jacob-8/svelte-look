<script>
  import Badge from '$lib/components/Badge.svelte'
  import Button from '$lib/components/Button.svelte'
  import Card from '$lib/components/Card.svelte'

  let { data } = $props()
</script>

<div class="page">
  <div class="header">
    <h1 class="title">{data.app_name}</h1>
    <Badge text={data.version} color="info" />
  </div>

  {#each data.cards as card}
    <Card title={card.title} description={card.description} />
  {/each}

  <div class="actions">
    <Button label="Get Started" variant="primary" />
    <Button label="Learn More" variant="secondary" />
  </div>
</div>

<style>
  .page {
    max-width: 36rem;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color);
    margin: 0;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
