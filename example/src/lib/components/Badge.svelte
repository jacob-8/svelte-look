<script>
  let { text, color = 'default' } = $props()
</script>

<span
  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
  class:bg-green-100={color === 'success'}
  class:text-green-800={color === 'success'}
  class:bg-red-100={color === 'error'}
  class:text-red-800={color === 'error'}
  class:bg-yellow-100={color === 'warning'}
  class:text-yellow-800={color === 'warning'}
  class:bg-blue-100={color === 'info'}
  class:text-blue-800={color === 'info'}
  class:bg-[var(--surface)]={color === 'default'}
  class:text-[var(--color)]={color === 'default'}
>
  {text}
</span>
