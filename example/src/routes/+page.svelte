<script>
  import Badge from '$lib/components/Badge.svelte'
  import Button from '$lib/components/Button.svelte'
  import Card from '$lib/components/Card.svelte'

  let { data } = $props()
</script>

<div class="max-w-xl mx-auto p-6 space-y-4">
  <div class="flex items-center gap-2">
    <h1 class="text-2xl font-bold text-[var(--color)]">{data.app_name}</h1>
    <Badge text={data.version} color="info" />
  </div>

  {#each data.cards as card}
    <Card title={card.title} description={card.description} />
  {/each}

  <div class="flex gap-2">
    <Button label="Get Started" variant="primary" />
    <Button label="Learn More" variant="secondary" />
  </div>
</div>
