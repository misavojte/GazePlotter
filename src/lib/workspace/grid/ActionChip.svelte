<script lang="ts">
  import Copy from 'lucide-svelte/icons/copy'
  import X from 'lucide-svelte/icons/x'
  import { useTooltipAction } from '$lib/tooltip'

  /**
   * The actions a selection carries: Duplicate and Remove, naming the same
   * verbs whether the selection is one plot or a group. It is the selection's
   * own chrome, so it wears the selection's colour and corner radius.
   *
   * It positions itself against the nearest positioned ancestor, so a host
   * puts that anchor on its outline's top-left corner.
   */
  interface Props {
    /** What the verbs act on: "plot", "3 plots". */
    scope: string
    onDuplicate: () => void
    onRemove: () => void
  }

  const { scope, onDuplicate, onRemove }: Props = $props()

  const tooltipAction = useTooltipAction()

  /** Closer than the default 10: the tooltip names one glyph of small chrome,
   *  so it should sit with the chip rather than float over the plot above. */
  const TOOLTIP_OFFSET = 5
</script>

<div class="action-chip" data-block-select>
  <button
    type="button"
    class="action"
    onclick={onDuplicate}
    aria-label="Duplicate {scope}"
    use:tooltipAction={{ content: 'Duplicate', position: 'top', offset: TOOLTIP_OFFSET }}
  >
    <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
  </button>
  <button
    type="button"
    class="action"
    onclick={onRemove}
    aria-label="Remove {scope}"
    use:tooltipAction={{ content: 'Remove', position: 'top', offset: TOOLTIP_OFFSET }}
  >
    <X size={16} strokeWidth={1.75} aria-hidden="true" />
  </button>
</div>

<style>
  /* Rides just above the selection outline, left edges on one line, in the
     outline's own colour and the plot's own corner radius. Two --action-size
     squares wide and one tall, so --rounded-lg is exactly half the height:
     the ends come out as true semicircles, not a clamped guess at one. The
     glyphs are the rail's: same size, same stroke, same ink on their fill. The
     clip is what lets a hovered half fill the pill right out to its edge. */
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

  /* A square each, squared off so the clip above gives them their ends. The
     glyph is the only thing inside, carrying no box of its own: no margin, no
     line box to sit on, and no padding beyond the optical shift below. */
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

  /* Optically centred rather than geometrically: the pill rounds each outer
     end away, which reads as air on that side and pushes the pair apart. The
     padding is a correction, not spacing, and moves each glyph half its width
     toward the middle. */
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
