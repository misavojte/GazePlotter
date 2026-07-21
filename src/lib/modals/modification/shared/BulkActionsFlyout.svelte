<script module lang="ts">
  import type { BaseInterpretedDataType } from '$lib/data/types'
  import type { MergeCard } from './groupedEntityEditor.svelte'

  // `type` (not `interface`) so it satisfies the `Record<string, unknown>`
  // constraint on `createMenuComponentItem`.
  export type BulkActionsFlyoutProps = {
    items: MergeCard<BaseInterpretedDataType>[]
    /** Replace `pattern` with `replacement` across every matching name. */
    onRename: (pattern: string, replacement: string) => void
  }
</script>

<script lang="ts">
  import { InputText, ButtonPreset, Button } from '$lib/shared/components'
  import { tooltipAction } from '$lib/tooltip'
  import type { MenuComponentBridgeProps } from '$lib/context-menu'

  // The flyout bridge (ContextSubMenuContent) spreads `componentProps` and
  // adds `item`/`onAction`/`close`. We only use `close`; the structured
  // callbacks come through `componentProps` since the bridge's `onAction`
  // can only carry `string | undefined`.
  type Props = BulkActionsFlyoutProps & MenuComponentBridgeProps

  let { items, onRename, close }: Props = $props()

  let pattern = $state('')
  let replacement = $state('')

  const WILDCARDS = [
    { label: '\\d+', tooltip: 'Any number' },
    { label: '\\s', tooltip: 'Any space' },
    { label: '[A-Za-z]', tooltip: 'Any letter' },
    { label: '.', tooltip: 'Any character' },
  ]

  const displayedName = (item: MergeCard<BaseInterpretedDataType>): string =>
    item.members[0]?.displayedName ?? ''

  const hasPattern = $derived(pattern.trim() !== '')

  // Entities matched by the pattern. `null` signals an invalid regex.
  const matched = $derived.by((): MergeCard<BaseInterpretedDataType>[] | null => {
    if (!hasPattern) return []
    try {
      const regex = new RegExp(pattern)
      return items.filter(item => regex.test(displayedName(item)))
    } catch {
      return null
    }
  })

  const matchedCount = $derived(matched?.length ?? 0)
  const canApply = $derived(matched !== null && hasPattern && matchedCount > 0)
</script>

<div class="flyout">
  <InputText
    label="Pattern (regex)"
    value={pattern}
    compact
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
      Matches {matchedCount} of {items.length} items
    {/if}
  </div>

  <div class="row">
    <div class="grow">
      <InputText
        label="Replace with"
        value={replacement}
        compact
        oninput={e => { replacement = e.detail }}
      />
    </div>
    <Button
      size="sm"
      variant="primary"
      isDisabled={!canApply}
      onclick={() => { onRename(pattern, replacement); close() }}
    >
      Replace
    </Button>
  </div>
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
</style>
