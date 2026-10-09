<script lang="ts">
  import type { LucideIconComponent } from '$lib/shared/icon'

  interface Props {
    label: string
    /** Longer explanation, shown as the native tooltip. */
    title?: string
    icon: LucideIconComponent
    disabled?: boolean
    onclick: () => void
  }

  let { label, title, icon: Icon, disabled = false, onclick }: Props = $props()
</script>

<button type="button" class="header-action" {title} {disabled} {onclick}>
  <span class="icon"><Icon size={16} strokeWidth={1.75} aria-hidden="true" /></span>
  <span class="label">{label}</span>
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
    color: var(--c-text);
    font: inherit;
    font-size: 13px;
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
