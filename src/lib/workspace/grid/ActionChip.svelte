<script lang="ts">
  import Copy from 'lucide-svelte/icons/copy'
  import X from 'lucide-svelte/icons/x'
  import { useTooltipAction } from '$lib/tooltip'
  import { DELETE_KEY_LABEL, withShortcut } from '../keys'

  /**
   * Duplicate and Remove for a selection of one plot or many, in the
   * selection's own colour. Positioned against the nearest positioned
   * ancestor: the host puts that anchor on its outline's top-left corner.
   */
  interface Props {
    /** What the verbs act on: "plot", "3 plots". */
    scope: string
    onDuplicate: () => void
    onRemove: () => void
  }

  const { scope, onDuplicate, onRemove }: Props = $props()

  const tooltipAction = useTooltipAction()

  /** Closer than the default: the tooltip sits with the chip, not over the plot above. */
  const TOOLTIP_OFFSET = 5
</script>

<div class="action-chip" data-block-select>
  <button
    type="button"
    class="action"
    onclick={onDuplicate}
    aria-label="Duplicate {scope}"
    use:tooltipAction={{ content: withShortcut('Duplicate', 'duplicate'), position: 'top', offset: TOOLTIP_OFFSET }}
  >
    <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
  </button>
  <button
    type="button"
    class="action"
    onclick={onRemove}
    aria-label="Remove {scope}"
    use:tooltipAction={{ content: `Remove (${DELETE_KEY_LABEL})`, position: 'top', offset: TOOLTIP_OFFSET }}
  >
    <X size={16} strokeWidth={1.75} aria-hidden="true" />
  </button>
</div>

<style>
  /* Just above the outline, left edges aligned. Two squares wide, one tall:
     --rounded-lg is half the height, so the ends are true semicircles. The
     clip lets a hovered half fill the pill out to its edge. */
  .action-chip {
    --action-size: 40px;
    position: absolute;
    left: 0;
    bottom: calc(100% + var(--spacing-xxs));
    display: inline-flex;
    align-items: stretch;
    background: var(--c-info);
    border: none;
    border-radius: var(--rounded-lg);
    overflow: hidden;
    z-index: 6;
    white-space: nowrap;
  }

  /* A square each; the clip above gives them their ends. */
  .action {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--action-size);
    height: var(--action-size);
    margin: 0;
    padding: 0;
    background: transparent;
    color: var(--c-white);
    border: none;
    border-radius: 0;
    cursor: pointer;
    transition: background-color var(--transition-fast) ease;
  }

  /* Optical centring: the rounded outer ends read as air, so each glyph
     shifts toward the middle. */
  .action:first-child {
    padding-left: 4px;
  }

  .action:last-child {
    padding-right: 4px;
  }

  .action:hover {
    background-color: color-mix(in srgb, var(--c-white) 20%, transparent);
  }

  .action:focus-visible {
    background-color: color-mix(in srgb, var(--c-white) 20%, transparent);
    outline: 2px solid var(--c-white);
    outline-offset: -5px;
  }

  .action:active {
    background-color: color-mix(in srgb, var(--c-white) 32%, transparent);
  }
</style>
