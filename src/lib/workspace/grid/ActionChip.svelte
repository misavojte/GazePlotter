<script lang="ts">
  import Copy from 'lucide-svelte/icons/copy'
  import X from 'lucide-svelte/icons/x'
  import { useTooltipAction } from '$lib/tooltip'

  /**
   * The actions a selection carries: Duplicate and Remove, worded the same
   * whether the selection is one plot or a group. Built like the workspace
   * rail (white surface, icon buttons, the label in a tooltip), since it is
   * the same kind of thing: a small cluster of canvas controls.
   *
   * It positions itself against the nearest positioned ancestor, so a host
   * puts that anchor on its outline's corner and the chip floats above it.
   */
  interface Props {
    /** What the verbs act on: "plot", "3 plots". */
    scope: string
    onDuplicate: () => void
    onRemove: () => void
  }

  const { scope, onDuplicate, onRemove }: Props = $props()

  const tooltipAction = useTooltipAction()
</script>

<div class="action-chip" data-block-select>
  <button
    type="button"
    class="action"
    onclick={onDuplicate}
    aria-label="Duplicate {scope}"
    use:tooltipAction={{ content: `Duplicate ${scope}`, position: 'top' }}
  >
    <Copy size={15} strokeWidth={1.75} aria-hidden="true" />
  </button>
  <button
    type="button"
    class="action danger"
    onclick={onRemove}
    aria-label="Remove {scope}"
    use:tooltipAction={{ content: `Remove ${scope}`, position: 'top' }}
  >
    <X size={15} strokeWidth={1.75} aria-hidden="true" />
  </button>
</div>

<style>
  /* Floats just above the selection outline, its left edge on the outline's.
     A pill of paper rather than a painted bar: the blue outline is the
     selection, this is only the handful of things to do with it. */
  .action-chip {
    position: absolute;
    left: 0;
    bottom: calc(100% + var(--spacing-xxs));
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    background: var(--c-white);
    border: 1px solid var(--c-border);
    border-radius: 999px;
    box-shadow: var(--shadow-md);
    z-index: 6;
    white-space: nowrap;
  }

  /* The rail's button, rounded to the pill it sits in. */
  .action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--c-darkgrey);
    cursor: pointer;
    transition:
      background-color var(--transition-fast) ease,
      color var(--transition-fast) ease;
  }

  .action:hover,
  .action:focus-visible {
    background-color: var(--c-lightgrey);
    color: var(--c-black);
  }

  .action.danger:hover,
  .action.danger:focus-visible {
    background-color: color-mix(in srgb, var(--c-error) 10%, transparent);
    color: var(--c-error);
  }

  .action:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: -2px;
  }

  .action:active {
    background-color: var(--c-midgrey);
  }
</style>
