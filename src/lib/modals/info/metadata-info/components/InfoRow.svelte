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
    gap: 1rem;
  }

  .label {
    font-weight: 500;
    color: #374151;
    min-width: fit-content;
  }

  .value {
    color: #1f2937;
    text-align: right;
    word-break: break-word;
  }

  .mono {
    font-family: monospace;
    font-size: 0.85rem;
    max-width: 300px;
    word-break: break-all;
  }

  .error-message {
    color: #991b1b;
    font-weight: 500;
    text-align: right;
  }

  .stack-trace {
    flex-direction: column;
    align-items: flex-start;
  }

  .error-stack {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #fafafa;
    border: 1px solid #e5e5e5;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    color: #4b5563;
    overflow-x: auto;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: left;
  }

  .exclusion .label {
    font-weight: 600;
    color: #374151;
  }

  .exclusion .value {
    color: #6b7280;
    font-size: 0.85rem;
  }
</style>
