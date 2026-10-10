<script lang="ts">
  import type { Action } from 'svelte/action'
  import type { LucideIconComponent } from '$lib/shared/icon'
  import type { TooltipActionOptions } from '$lib/tooltip/tooltip.action'

  interface Props {
    label: string
    /** Longer explanation, shown in the app's tooltip. */
    hint: string
    /** The app's tooltip, reached through the page's session. */
    tooltip: Action<HTMLElement, TooltipActionOptions>
    icon: LucideIconComponent
    disabled?: boolean
    /** A status dot notched into the icon's corner. */
    badge?: 'unsaved' | 'saved' | 'new' | null
    /** What the dot means, for screen readers. */
    badgeLabel?: string
    onclick: () => void
  }

  let {
    label,
    hint,
    tooltip,
    icon: Icon,
    disabled = false,
    badge = null,
    badgeLabel = '',
    onclick,
  }: Props = $props()
</script>

<button
  type="button"
  class="header-action"
  {disabled}
  {onclick}
  use:tooltip={{ content: hint, position: 'bottom' }}
>
  <span class="icon-wrap">
    <span class="icon" class:notched={badge !== null}>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
    </span>
    {#key badge}
      {#if badge}<span class="badge {badge}" aria-hidden="true"></span>{/if}
    {/key}
  </span>
  <span class="label">{label}</span>
  {#if badge && badgeLabel}<span class="visually-hidden">{badgeLabel}</span>{/if}
</button>

<style>
  .header-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    box-sizing: border-box;
    padding: 0 10px;
    border: none;
    border-radius: var(--rounded-md);
    background: transparent;
    color: var(--c-black);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 500;
    letter-spacing: -0.005em;
    cursor: pointer;
    transition:
      background-color var(--transition-fast) ease,
      color var(--transition-fast) ease;
  }

  .header-action:hover:not(:disabled),
  .header-action:focus-visible {
    background-color: var(--c-lightgrey);
    color: var(--c-black);
  }

  .header-action:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: -2px;
  }

  .header-action:active:not(:disabled) {
    background-color: var(--c-grey);
  }

  /* Muted glyph, ink label: the word carries the action, the icon the cue. */
  .icon {
    display: flex;
    color: var(--c-darkgrey);
    transition: color var(--transition-fast) ease;
  }

  .icon-wrap {
    position: relative;
    display: flex;
  }

  /* The dot sits in a notch cut out of the glyph, with a gap around it, so it
     reads on any background (hover included). */
  .icon.notched {
    mask: radial-gradient(circle at calc(100% - 1.5px) 1.5px, transparent 4.5px, #000 5px);
  }

  .badge {
    position: absolute;
    top: -1.5px;
    right: -1.5px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: badge-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Each change of state pops the new dot into the notch. */
  @keyframes badge-pop {
    from {
      transform: scale(0.2);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .badge {
      animation: none;
    }
  }

  .badge.new {
    background: var(--c-midgrey);
  }

  .badge.unsaved {
    background: var(--c-warning);
  }

  .badge.saved {
    background: var(--c-success);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .header-action:hover:not(:disabled) .icon,
  .header-action:focus-visible .icon {
    color: var(--c-black);
  }

  .header-action:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Narrow screens: icons only; the label stays for screen readers. */
  @media (max-width: 640px) {
    .header-action {
      width: 32px;
      padding: 0;
      justify-content: center;
    }

    .label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  }
</style>
