<script lang="ts">
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { createMenuComponentItem } from '$lib/context-menu'

  import RecurrencePlotFigure from './RecurrencePlotFigure.svelte'
  import RecurrenceButtonMenu from './RecurrenceButtonMenu.svelte'
  import { BasePlot } from '$lib/plots/shared/components'
  import GroupSelect from '$lib/shared/components/GroupSelect.svelte'
  import type { GroupSelectItem } from '$lib/shared/components'

  import { getRecurrenceData } from '$lib/plots/recurrence/core/transformer'
  import { RECURRENCE_METHODS } from '$lib/plots/recurrence/const'
  import {
    buildDiagonalLineMask,
    buildHorizontalLineMask,
    buildVerticalLineMask,
  } from '$lib/plots/recurrence/core/rqa'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getStimuliOptions,
    getParticipantOptions,
    PreviewModel,
  } from '$lib/plots/shared'
  import RecurrenceViewSettings from './RecurrenceViewSettings.svelte'

  import type {
    RecurrencePlotItem,
    RecurrencePlotSettings,
    RecurrenceHighlight,
    RecurrenceMasking,
  } from '$lib/plots/recurrence/types'

  interface Props {
    item: RecurrencePlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  type RecurrencePreview = {
    radius: number
    gridSize: number
    showDuration: boolean
    minLineLength: number
    highlight: string
    masking: string
  }

  const preview = new PreviewModel<
    RecurrencePreview,
    Partial<RecurrencePlotSettings>
  >({
    getCommitted: () => ({
      radius: settings.radius,
      gridSize: settings.gridSize,
      showDuration: settings.showDuration,
      minLineLength: settings.minLineLength,
      highlight: settings.highlight,
      masking: settings.masking,
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<RecurrencePlotSettings> = {}
      if (draft.radius !== committed.radius) updates.radius = draft.radius
      if (draft.gridSize !== committed.gridSize)
        updates.gridSize = draft.gridSize
      if (draft.showDuration !== committed.showDuration)
        updates.showDuration = draft.showDuration
      if (draft.minLineLength !== committed.minLineLength)
        updates.minLineLength = draft.minLineLength
      if (draft.highlight !== committed.highlight)
        updates.highlight = draft.highlight as RecurrenceHighlight
      if (draft.masking !== committed.masking)
        updates.masking = draft.masking as RecurrenceMasking
      return updates
    },
  })

  const syncs = preview.fields

  function handleMenuClose() {
    untrack(() => {
      const updates = preview.buildPatch()
      if (!updates || Object.keys(updates).length === 0) {
        preview.resetAll()
        return
      }
      workspace.updateItemSettings(
        item.id,
        $state.snapshot(updates),
        $state.snapshot(source)
      )
      preview.resetAll()
    })
  }

  const source = untrack(() => createCommandSourcePlotPattern(item, 'plot'))

  const recurrenceData = $derived.by(() => {
    return getRecurrenceData(engine, settings)
  })

  // Compute highlight mask based on current highlight mode.
  // The mask builders operate on the mathematical upper triangle (j > i),
  // which is the visual LOWER triangle (since rowToY inverts the y-axis).
  // Visual upper = i > j, visual lower = i < j (equivalently j > i).
  // Horizontal lines in one triangle become vertical in the other due to
  // the matrix symmetry, so we must swap h↔v when mirroring.
  const highlightMask = $derived.by((): Uint8Array | null => {
    if (!recurrenceData) return null
    const h = settings.highlight
    if (h === 'none') return null

    const { matrix, fixationCount: N } = recurrenceData
    const L = settings.minLineLength
    const showLower = settings.masking !== 'diagonalLower'

    const mask = new Uint8Array(N * N)

    // Masks computed on math upper triangle (j > i = visual lower)
    let lowerSrc: Uint8Array // source for visual lower triangle
    let upperSrc: Uint8Array // source to transpose into visual upper triangle

    if (h === 'diagonal') {
      const dMask = buildDiagonalLineMask(matrix, N, L)
      lowerSrc = dMask
      upperSrc = dMask // diagonal lines mirror to diagonal lines
    } else if (h === 'horizontal') {
      lowerSrc = buildHorizontalLineMask(matrix, N, L)
      // Horizontal in visual upper = vertical in math upper (transposed)
      upperSrc = buildVerticalLineMask(matrix, N, L)
    } else {
      // h === 'vertical'
      lowerSrc = buildVerticalLineMask(matrix, N, L)
      // Vertical in visual upper = horizontal in math upper (transposed)
      upperSrc = buildHorizontalLineMask(matrix, N, L)
    }

    // Copy visual lower triangle (j > i) from lowerSrc
    if (showLower) {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (lowerSrc[i * N + j]) mask[i * N + j] = 1
        }
      }
    }

    // Transpose upperSrc into visual upper triangle (i > j)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (upperSrc[i * N + j]) mask[j * N + i] = 1
      }
    }

    return mask
  })

  function updateSettings(updates: Partial<typeof settings>) {
    workspace.updateItemSettings(item.id, updates, source)
  }

  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: getStimuliOptions(engine),
      value: settings.stimulusId.toString(),
      onchange: (e: CustomEvent) =>
        updateSettings({ stimulusId: parseInt(e.detail) }),
    },
    {
      label: 'Participant',
      options: getParticipantOptions(engine),
      value: settings.participantId.toString(),
      onchange: (e: CustomEvent) =>
        updateSettings({ participantId: parseInt(e.detail) }),
    },
    {
      label: 'View',
      value: settings.recurrenceMethod,
      onClose: handleMenuClose,
      options: RECURRENCE_METHODS.map(opt =>
        createMenuComponentItem({
          ...opt,
          onAction: (v?: string) => {
            if (v)
              updateSettings({
                recurrenceMethod:
                  v as RecurrencePlotSettings['recurrenceMethod'],
              })
          },
          closeOnAction: false,
          component: RecurrenceViewSettings,
          componentHeight: 310,
          componentProps: {
            syncs,
            method: opt.value,
          },
        })
      ),
    },
  ])
</script>

<BasePlot
  {item}
  hasData={recurrenceData !== null}
  unavailableMessage={!engine.hasSpatialData
    ? 'This visualization requires spatial coordinate data.'
    : null}
>
  {#snippet header()}
    <div class="controls">
      <GroupSelect ariaLabel="Recurrence Plot filters" items={selectItems} />
      <div class="menu-button">
        <RecurrenceButtonMenu {item} />
      </div>
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    <div class="figure-container">
      {#if recurrenceData}
        <RecurrencePlotFigure
          data={recurrenceData}
          highlight={settings.highlight}
          masking={settings.masking}
          {highlightMask}
          {width}
          {height}
        />
      {/if}
    </div>
  {/snippet}
</BasePlot>

<style>
  .controls {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    background: inherit;
  }

  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
