<script lang="ts">
  import { untrack } from 'svelte'
  interface Props {
    isDisabled?: boolean
    children?: import('svelte').Snippet
    onclick?: (event: MouseEvent) => void
    size?: 'sm' | 'md'
    variant?: 'primary' | 'secondary'
    href?: string
    noopener?: boolean
    type?: 'button' | 'submit' | 'link'
    target?: '_self' | '_blank'
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
    target = '_blank',
  }: Props = $props()

  const isLink = untrack(() => type === 'link' || href !== undefined)
</script>

{#if isLink}
  <a
    class={[size, variant].join(' ')}
    {href}
    {target}
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
    type={type === 'link' ? 'button' : type}
  >
    {@render children?.()}
  </button>
{/if}

<style>
  /* Same heights and corners as the fields: md is the 34px modal control,
     sm the 26px compact one. min-height, so a long label can still wrap. */
  button,
  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: var(--rounded-md);
    text-align: center;
    text-decoration: none;
    line-height: var(--leading-tight);
    cursor: pointer;
    font-weight: 600;
    transition:
      background-color var(--transition-fast) ease,
      border-color var(--transition-fast) ease,
      color var(--transition-fast) ease;
  }

  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: 2px;
  }

  /* Disabled state - applies to all variants */
  button:disabled,
  a:disabled {
    background-color: var(--c-lightgrey) !important;
    color: var(--c-midgrey) !important;
    border: 1px solid var(--c-grey) !important;
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

  /* Sizes */
  .sm {
    min-height: 26px;
    padding: 4px 10px;
    border-radius: var(--rounded);
    font-size: var(--text-sm);
    font-family: var(--font-small);
  }
  .md {
    min-height: 34px;
    padding: 6px 14px;
    font-size: var(--text-md);
  }
</style>
