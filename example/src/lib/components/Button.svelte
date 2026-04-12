<script>
  let { label = 'Click me', variant = 'primary', onclick } = $props()
</script>

<button
  class="px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
  class:bg-[var(--primary)]={variant === 'primary'}
  class:text-[var(--on-primary)]={variant === 'primary'}
  class:bg-[var(--surface)]={variant === 'secondary'}
  class:text-[var(--color)]={variant === 'secondary'}
  class:bg-[var(--danger)]={variant === 'danger'}
  class:text-white={variant === 'danger'}
  {onclick}
>
  {label}
</button>
