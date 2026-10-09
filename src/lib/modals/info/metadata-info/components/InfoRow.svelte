<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    label: string
    value?: string | number
    variant?: 'default' | 'error' | 'mono' | 'stack' | 'exclusion'
    children?: Snippet
  }

  let {
    label,
    value,
    variant = 'default',
    children,
  }: Props = $props()
</script>

<div class="info-item" class:stack-trace={variant === 'stack'} class:exclusion={variant === 'exclusion'}>
  <span class="label">{label}</span>
  {#if value !== undefined || children}
    {#if variant === 'stack'}
      <pre class="value error-stack">{value ?? ''}{@render children?.()}</pre>
    {:else}
      <span
        class="value"
        class:error-message={variant === 'error'}
        class:mono={variant === 'mono'}
      >
        {value ?? ''}{@render children?.()}
      </span>
    {/if}
  {/if}
</div>

<style>
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .label {
    font-weight: 500;
    color: var(--c-black);
    min-width: fit-content;
  }

  .value {
    color: var(--c-black);
    text-align: right;
    word-break: break-word;
  }

  .mono {
    font-family: monospace;
    font-size: var(--text-lg);
    max-width: 300px;
    word-break: break-all;
  }

  .error-message {
    color: var(--c-error);
    font-weight: 500;
    text-align: right;
  }

  .stack-trace {
    flex-direction: column;
    align-items: flex-start;
  }

  .error-stack {
    margin-top: 8px;
    padding: 12px;
    background: var(--c-darkwhite);
    border: 1px solid var(--c-border);
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: var(--text-sm);
    color: var(--c-darkgrey);
    overflow-x: auto;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: left;
  }

  .exclusion .label {
    font-weight: 600;
    color: var(--c-black);
  }

  .exclusion .value {
    color: var(--c-darkgrey);
    font-size: var(--text-lg);
  }
</style>
