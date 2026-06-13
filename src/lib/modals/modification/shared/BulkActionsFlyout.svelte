<script module lang="ts">
  import type { BaseInterpretedDataType } from '$lib/data/types'
  import type { EntityGroup } from './groupedEntityEditor.svelte'

  export type BulkEntity = BaseInterpretedDataType | EntityGroup

  // `type` (not `interface`) so it satisfies the `Record<string, unknown>`
  // constraint on `createMenuComponentItem`.
  export type BulkActionsFlyoutProps = {
    mode: 'rename' | 'visibility'
    items: BulkEntity[]
    grouped?: boolean
    /** Replace `pattern` with `replacement` across every matching name. */
    onRename?: (pattern: string, replacement: string) => void
    /** Show/hide the target groups (already resolved for the invert toggle). */
    onSetVisibility?: (targets: EntityGroup[], visible: boolean) => void
  }
</script>

<script lang="ts">
  import { InputText, InputCheck, ButtonPreset, ButtonMajor } from '$lib/shared/components'
  import { tooltipAction } from '$lib/tooltip'
  import type { MenuComponentBridgeProps } from '$lib/context-menu'

  // The flyout bridge (ContextSubMenuContent) spreads `componentProps` and
  // adds `item`/`onAction`/`close`. We only use `close`; the structured
  // callbacks come through `componentProps` since the bridge's `onAction`
  // can only carry `string | undefined`.
  type Props = BulkActionsFlyoutProps & MenuComponentBridgeProps

  let { mode, items, grouped = false, onRename, onSetVisibility, close }: Props =
    $props()

  let pattern = $state('')
  let replacement = $state('')
  let invert = $state(false)

  const WILDCARDS = [
    { label: '\\d+', tooltip: 'Any number' },
    { label: '\\s', tooltip: 'Any space' },
    { label: '[A-Za-z]', tooltip: 'Any letter' },
    { label: '.', tooltip: 'Any character' },
  ]

  const displayedName = (item: BulkEntity): string =>
    'members' in item
      ? (item.members[0]?.displayedName ?? '')
      : (item.displayedName ?? '')

  const hasPattern = $derived(pattern.trim() !== '')

  // Entities matched by the pattern. `null` signals an invalid regex.
  const matched = $derived.by((): BulkEntity[] | null => {
    if (!hasPattern) return []
    try {
      const regex = new RegExp(pattern)
      return items.filter(item => regex.test(displayedName(item)))
    } catch {
      return null
    }
  })

  // Visibility acts on the complement when "invert" is on; rename always
  // acts on the matched set (its regex passes non-matching names through).
  const targets = $derived.by((): BulkEntity[] | null => {
    if (matched === null) return null
    if (mode === 'visibility' && invert) {
      const set = new Set(matched)
      return items.filter(item => !set.has(item))
    }
    return matched
  })

  const matchedCount = $derived(matched?.length ?? 0)
  const canApply = $derived(matched !== null && hasPattern && (targets?.length ?? 0) > 0)
</script>

<div class="flyout">
  <InputText
    label="Pattern (regex)"
    value={pattern}
    fill={true}
    oninput={e => { pattern = e.detail }}
  />

  <div class="wildcards">
    {#each WILDCARDS as w}
      <span use:tooltipAction={{ content: w.tooltip, position: 'bottom' }}>
        <ButtonPreset label={w.label} onclick={() => { pattern += w.label }} />
      </span>
    {/each}
  </div>

  <div class="status" class:error={matched === null}>
    {#if !hasPattern}
      Enter a pattern to match displayed names
    {:else if matched === null}
      Invalid regular expression
    {:else}
      Matches {matchedCount} of {items.length} items{#if mode === 'visibility' && invert} · acting on the other {items.length - matchedCount}{/if}
    {/if}
  </div>

  {#if mode === 'rename'}
    <div class="row">
      <div class="grow">
        <InputText
          label="Replace with"
          value={replacement}
          fill={true}
          oninput={e => { replacement = e.detail }}
        />
      </div>
      <ButtonMajor
        size="sm"
        variant="primary"
        isDisabled={!canApply}
        onclick={() => { onRename?.(pattern, replacement); close() }}
      >
        Replace
      </ButtonMajor>
    </div>
  {:else}
    <InputCheck
      label="Invert match"
      sublabel="Act on items that don't match"
      appearance="compact"
      checked={invert}
      onchange={e => { invert = e.detail }}
    />
    <div class="row">
      <ButtonMajor
        size="sm"
        isDisabled={!canApply}
        onclick={() => { onSetVisibility?.(targets as EntityGroup[], true); close() }}
      >
        Show
      </ButtonMajor>
      <ButtonMajor
        size="sm"
        isDisabled={!canApply}
        onclick={() => { onSetVisibility?.(targets as EntityGroup[], false); close() }}
      >
        Hide
      </ButtonMajor>
    </div>
  {/if}
</div>

<style>
  .flyout {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .wildcards {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .status {
    font-size: 12px;
    color: var(--c-darkgrey);
    line-height: 1.3;
  }

  .status.error {
    color: var(--c-brand);
    font-weight: 500;
  }

  .row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  /* Compact the shared inputs to fit the narrow flyout. Scoped to this
     component — no global !important overrides. */
  .flyout :global(input[type='text']) {
    padding: 0.3rem 0.45rem;
    font-size: 12px;
  }

  .flyout :global(label) {
    font-size: 11px;
  }

  /* InputCheck's compact sublabel defaults to 0.8rem — larger than its
     11px main label. Shrink it so the hint reads as secondary text, and
     tighten the gap between the label and its hint. */
  .flyout :global(.label-content) {
    gap: 1px;
  }

  .flyout :global(.sub-label) {
    font-size: 10px;
    line-height: 1.2;
  }
</style>
