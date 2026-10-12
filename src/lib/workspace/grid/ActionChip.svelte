<script lang="ts">
  import Copy from 'lucide-svelte/icons/copy'
  import X from 'lucide-svelte/icons/x'

  /**
   * The chip that hangs above a selection's top-left corner: Duplicate and
   * Remove, worded the same whether the selection is one plot or a group.
   * It positions itself against the nearest positioned ancestor, so a host
   * places that anchor and the chip hangs from it.
   */
  interface Props {
    /** What the verbs act on, for screen readers: "item", "3 plots". */
    scope: string
    onDuplicate: () => void
    onRemove: () => void
  }

  const { scope, onDuplicate, onRemove }: Props = $props()
</script>

<div class="action-chip" data-block-select>
  <button
    type="button"
    class="action-chip-button"
    onclick={onDuplicate}
    aria-label="Duplicate {scope}"
  >
    <Copy size={12} strokeWidth={1.75} aria-hidden="true" />
    <span>Duplicate</span>
  </button>
  <button
    type="button"
    class="action-chip-button"
    onclick={onRemove}
    aria-label="Remove {scope}"
  >
    <X size={12} strokeWidth={1.75} aria-hidden="true" />
    <span>Remove</span>
  </button>
</div>

<style>
  /* Sits on the selection outline's top edge, both top corners rounded at
     6px; content-width, so it never stretches across what it acts on. */
  .action-chip {
    position: absolute;
    left: 0;
    bottom: 100%;
    display: inline-flex;
    align-items: stretch;
    gap: 0;
    padding: 2px 4px;
    background: var(--c-info);
    border: none;
    border-radius: var(--rounded-md) var(--rounded-md) 0 0;
    z-index: 6;
    white-space: nowrap;
  }

  .action-chip-button {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xxs);
    padding: 4px 8px;
    background: transparent;
    color: var(--c-white);
    border: none;
    border-radius: 3px;
    font-size: var(--text-xs);
    font-family: var(--font-small);
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--transition-fast) ease, color var(--transition-fast) ease;
  }

  .action-chip-button:hover {
    background: color-mix(in srgb, var(--c-white) 18%, transparent);
  }
</style>
