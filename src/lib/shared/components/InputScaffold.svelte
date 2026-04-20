<script lang="ts">
  import { isInPane } from './paneContext'
  /**
   * InputScaffold is a base component that provides consistent styling and structure
   * for form input components. It handles the layout of labels and input elements,
   * ensuring consistent spacing and accessibility across all input types.
   *
   * This component is used as a wrapper by other input components (Text, Number, File, etc.)
   * to maintain a consistent look and feel throughout the application.
   *
   * @example
   * ```svelte
   * <InputScaffold label="Username" id="username">
   *   <input type="text" />
   * </InputScaffold>
   * ```
   */
  interface Props {
    /** The text label for the input field */
    label: string
    /** The unique identifier for the input field */
    id: string
    /** Hides the visible label for dense layouts while keeping wrapper structure */
    showLabel?: boolean
    /** Removes the default bottom margin for dense inline layouts */
    compact?: boolean
    /** Allows the scaffold wrapper to grow within flex layouts */
    fill?: boolean
    /** Uses the smaller compact label sizing for dense UI surfaces */
    labelSize?: 'default' | 'compact'
    /** The input element(s) to be wrapped by the scaffold */
    children?: import('svelte').Snippet<[any]>
  }

  let {
    label,
    id,
    showLabel = true,
    compact = false,
    fill = false,
    labelSize = 'default',
    children,
  }: Props = $props()

  /** Inside a Pane / PaneSheet → auto-apply the compact label + spacing. */
  const inPane = isInPane()
  const effectiveCompact = $derived(compact || inPane)
  const effectiveLabelSize = $derived(labelSize === 'compact' || inPane ? 'compact' : 'default')
</script>

<div class="input" class:compact={effectiveCompact} class:fill class:noLabel={!showLabel}>
  {#if showLabel}
    <label class:compact-label={effectiveLabelSize === 'compact'} for={id}>{label}</label
    >
  {/if}
  {@render children?.({ itemtype: 'input' })}
</div>

<style>
  .input {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input.compact {
    margin-bottom: 0;
    gap: 2px;
  }

  .input.noLabel {
    gap: 0;
  }

  .input.fill {
    width: 100%;
    flex: 1;
  }

  label {
    font-size: 12px;
    color: var(--c-darkgrey);
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  label.compact-label {
    font-size: 11px;
  }
</style>
