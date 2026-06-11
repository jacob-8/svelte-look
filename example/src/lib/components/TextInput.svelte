<script>
  let { label = '', placeholder = '', value = $bindable('') } = $props()
  let focused = $state(false)
</script>

<div class="field">
  {#if label}
    <label class="label">{label}</label>
  {/if}
  <input
    type="text"
    {placeholder}
    bind:value
    onfocus={() => focused = true}
    onblur={() => focused = false}
    class={['input', { focused }]}
  />
  {#if value}
    <p class="hint">Characters: {value.length}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color);
  }

  .input {
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    font-size: 0.875rem;
    color: var(--color);
    background: var(--background);
    outline: none;
    transition: border-color 0.15s;
  }

  .input.focused {
    border-color: var(--primary);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin: 0;
  }
</style>
