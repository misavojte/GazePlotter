<script lang="ts">
  import Copy from 'lucide-svelte/icons/copy'
  import X from 'lucide-svelte/icons/x'

  /**
   * The actions a selection carries: Duplicate and Remove, worded the same
   * whether the selection is one plot or a group. It is the selection's own
   * chrome, so it wears the selection's colour and corner radius rather than
   * the rail's paper-and-border look.
   *
   * It positions itself against the nearest positioned ancestor, so a host
   * puts that anchor on its outline's top-left corner.
   */
  interface Props {
    /** What the verbs act on, for screen readers: "plot", "3 plots". */
    scope: string
    onDuplicate: () => void
    onRemove: () => void
  }

  const { scope, onDuplicate, onRemove }: Props = $props()
</script>

<div class="action-chip" data-block-select>
  <button
    type="button"
    class="action"
    onclick={onDuplicate}
    aria-label="Duplicate {scope}"
  >
    <Copy size={12} strokeWidth={1.75} aria-hidden="true" />
    <span>Duplicate</span>
  </button>
  <button
    type="button"
    class="action"
    onclick={onRemove}
    aria-label="Remove {scope}"
  >
    <X size={12} strokeWidth={1.75} aria-hidden="true" />
    <span>Remove</span>
  </button>
</div>

<style>
  /* Rides just above the selection outline, left edges on one line, in the
     outline's own colour and corner radius: at this height --rounded-lg
     renders as a pill, so the chip and the outline round alike. */
  .action-chip {
    position: absolute;
    left: 0;
    bottom: calc(100% + var(--spacing-xxs));
    display: inline-flex;
    align-items: stretch;
    gap: 2px;
    padding: 2px;
    background: var(--c-info);
    border: none;
    border-radius: var(--rounded-lg);
    z-index: 6;
    white-space: nowrap;
  }

  .action {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xxs);
    padding: 3px 9px;
    background: transparent;
    color: var(--c-white);
    border: none;
    border-radius: var(--rounded-lg);
    font-size: var(--text-xs);
    font-family: var(--font-small);
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color var(--transition-fast) ease;
  }

  .action:hover {
    background-color: color-mix(in srgb, var(--c-white) 18%, transparent);
  }

  /* On the selection's own blue, the ring is white: the same shape the
     button already has, so focus fills it in rather than boxing it. */
  .action:focus-visible {
    background-color: color-mix(in srgb, var(--c-white) 18%, transparent);
    outline: 1px solid var(--c-white);
    outline-offset: -1px;
  }

  .action:active {
    background-color: color-mix(in srgb, var(--c-white) 30%, transparent);
  }
</style>
