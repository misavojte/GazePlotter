<script lang="ts">
  import { generateUniqueId } from '$lib/shared/utils/idUtils'
  import { isInPane } from './paneContext'

  interface Props {
    options: { value: string; label: string }[]
    legend?: string
    ariaLabel?: string
    value?: string
    appearance?: 'default' | 'compact'
    direction?: 'column' | 'row'
    /** Multi-selection "Mixed": the bound plots disagree on this field. Shows no
     *  option selected; picking one applies it to all (and resolves it). */
    mixed?: boolean
    onchange?: (event: CustomEvent<string>) => void
  }

  let {
    options,
    legend = '',
    ariaLabel,
    value = $bindable(options[0].value),
    appearance = 'default',
    direction = 'column',
    mixed = false,
    onchange,
  }: Props = $props()

  const uniqueID: number = generateUniqueId()
  const hasLegend = $derived(legend.trim().length > 0)
  /** Inside a Pane / PaneSheet → auto-apply compact appearance. */
  const inPane = isInPane()
  const isCompact = $derived(appearance === 'compact' || inPane)
  const isRow = $derived(direction === 'row')

  const slugify = (str = ''): string =>
    str.toLowerCase().replace(/ /g, '-').replace(/\./g, '')
</script>

<div
  role="radiogroup"
  class="group-container"
  class:compact={isCompact}
  aria-labelledby={hasLegend ? `label-${uniqueID}` : undefined}
  aria-label={hasLegend ? undefined : ariaLabel}
  id={`group-${uniqueID}`}
>
  {#if hasLegend}
    <div class="legend" id={`label-${uniqueID}`}>
      {legend}
    </div>
  {/if}
  <div class="options" class:row={isRow}>
    {#each options as { value: optionValue, label }}
      {@const optionId = `${slugify(ariaLabel ?? legend)}-${slugify(label)}-${uniqueID}`}
      <div class="option">
        <input
          class="sr-only"
          type="radio"
          id={optionId}
          name={`group-${uniqueID}`}
          value={optionValue}
          checked={!mixed && value === optionValue}
          onchange={() => {
            value = optionValue
            onchange?.(new CustomEvent('change', { detail: optionValue }))
          }}
        />
        <label for={optionId}>
          {label}
        </label>
      </div>
    {/each}
  </div>
</div>

<style>
  .group-container {
    --radio-size: 14px;
    --radio-dot-size: 8px;
    --label-padding-left: 1.5rem;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xxs);
  }

  .group-container.compact {
    --radio-size: 12px;
    --radio-dot-size: 6px;
    --label-padding-left: 17px;
    gap: 2px;
    width: 100%;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xxs);
  }

  .group-container.compact .options {
    gap: 3px;
    width: 100%;
  }

  .options.row {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
  }

  .group-container.compact .options.row {
    gap: 10px;
  }

  .option {
    position: relative;
    width: 100%;
  }

  .options.row .option {
    width: auto;
    flex: 1;
  }

  .group-container.compact .legend {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
    margin-bottom: 2px;
  }

  label {
    user-select: none;
    position: relative;
    display: inline-block;
    padding-left: var(--label-padding-left);
    cursor: pointer;
    line-height: 1.25;
  }

  .sr-only {
    position: absolute;
    clip: rect(1px, 1px, 1px, 1px);
    padding: 0;
    border: 0;
    height: 1px;
    width: 1px;
    overflow: hidden;
  }

  .group-container.compact label {
    display: flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    padding-left: 20px;
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .group-container.compact .options.row label {
    width: auto;
  }

  input[type='radio'] + label::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: var(--radio-size);
    height: var(--radio-size);
    transform: translateY(-50%);
    background: var(--c-white);
    border: 1px solid var(--c-midgrey);
    border-radius: 50%;
    box-sizing: border-box;
  }

  input[type='radio'] + label::after {
    content: '';
    position: absolute;
    width: var(--radio-dot-size);
    height: var(--radio-dot-size);
    left: 3px;
    top: 50%;
    transform: translateY(-50%) scale(0);
    background: var(--c-brand);
    border: 1px solid var(--c-brand);
    border-radius: 50%;
    box-sizing: border-box;
    transition: transform var(--transition-fast) ease-out;
  }

  input[type='radio']:checked + label::before {
    border-color: var(--c-brand);
  }

  input[type='radio']:checked + label::after {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }

  input[type='radio']:focus-visible + label::before {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-brand) 35%, transparent);
  }
</style>
