<script lang="ts">
  import { untrack } from 'svelte'
  interface Props {
    isDisabled?: boolean
    children?: import('svelte').Snippet
    onclick?: (event: MouseEvent) => void
    size?: 'sm' | 'md'
    variant?: 'primary' | 'secondary' | 'info'
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
    transition: all var(--transition-normal) ease;
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

  /* Info variant */
  .info {
    background-color: color-mix(in srgb, var(--c-info) 10%, transparent);
    color: var(--c-info);
    border: 1px solid color-mix(in srgb, var(--c-info) 30%, transparent);
  }
  .info:hover:not(:disabled) {
    background-color: color-mix(in srgb, var(--c-info) 15%, transparent);
    border-color: color-mix(in srgb, var(--c-info) 40%, transparent);
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
