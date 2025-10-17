<script lang="ts">
  interface Props {
    isDisabled?: boolean
    children?: import('svelte').Snippet
    onclick?: (event: MouseEvent) => void
    size?: 'sm' | 'md'
    variant?: 'primary' | 'secondary' | 'info'
    href?: string
    noopener?: boolean
    type?: 'button' | 'submit' | 'link'
  }

  let {
    isDisabled = false,
    children,
    onclick,
    size = 'md',
    variant = 'secondary',
    href,
    noopener = false,
    type = 'button',
  }: Props = $props()

  const isLink = type === 'link' || href !== undefined
</script>

{#if isLink}
  <a
    class={[size, variant].join(' ')}
    {href}
    target="_blank"
    rel={noopener ? 'noopener' : undefined}
    {onclick}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    class={[size, variant].join(' ')}
    disabled={isDisabled}
    {onclick}
    {type}
  >
    {@render children?.()}
  </button>
{/if}

<style>
  button,
  a {
    border: 1px solid transparent;
    padding: 0.75em 1.5em;
    border-radius: var(--rounded-lg);
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 14px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  /* Disabled state - applies to all variants */
  button:disabled,
  a:disabled {
    background-color: #f5f5f5 !important;
    color: #a0a0a0 !important;
    border: 1px solid #e0e0e0 !important;
    opacity: 0.6 !important;
    cursor: not-allowed;
  }

  /* Primary variant */
  .primary {
    background-color: var(--c-brand);
    color: white;
  }
  .primary:hover:not(:disabled) {
    background-color: var(--c-brand-dark);
  }

  /* Secondary variant */
  .secondary {
    background-color: var(--c-lightgrey);
    color: var(--c-black);
  }
  .secondary:hover:not(:disabled) {
    background-color: var(--c-grey);
  }

  /* Info variant */
  .info {
    background-color: rgba(0, 127, 255, 0.1);
    color: rgba(0, 127, 255, 0.9);
    border: 1px solid rgba(0, 127, 255, 0.3);
  }
  .info:hover:not(:disabled) {
    background-color: rgba(0, 127, 255, 0.15);
    border-color: rgba(0, 127, 255, 0.4);
  }

  /* Sizes */
  .sm {
    padding: 0.5em 1em;
    font-size: 12px;
  }
  .md {
    padding: 0.75em 1.5em;
    font-size: 14px;
  }
</style>
