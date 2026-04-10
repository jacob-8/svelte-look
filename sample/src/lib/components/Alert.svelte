<script>
  let { message, type = 'info', dismissible = false } = $props()
</script>

<div
  class="flex items-start gap-2 p-3 rounded-lg text-sm"
  class:bg-blue-50={type === 'info'}
  class:text-blue-800={type === 'info'}
  class:bg-red-50={type === 'error'}
  class:text-red-800={type === 'error'}
  class:bg-green-50={type === 'success'}
  class:text-green-800={type === 'success'}
  class:bg-yellow-50={type === 'warning'}
  class:text-yellow-800={type === 'warning'}
>
  <span class="flex-1">{message}</span>
  {#if dismissible}
    <button class="font-bold opacity-50 hover:opacity-100">×</button>
  {/if}
</div>
