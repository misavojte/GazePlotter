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
  import { buildHighlightMask } from '$lib/plots/recurrence/core/rqa'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getStimuliOptions,
    getParticipantOptions,
    PreviewModel,
    createMenuCloseHandler,
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
    buildPatch: (draft, committed) =>
      PreviewModel.buildSimplePatch(draft, committed, [
        'radius', 'gridSize', 'showDuration', 'minLineLength',
        'highlight', 'masking',
      ]) as Partial<RecurrencePlotSettings>,
  })

  const syncs = preview.fields

  const handleMenuClose = createMenuCloseHandler(preview, patch =>
    workspace.updateItemSettings(item.id, patch, $state.snapshot(source))
  )

  const source = untrack(() => createCommandSourcePlotPattern(item, 'plot'))

  const recurrenceData = $derived.by(() => {
    return getRecurrenceData(engine, settings)
  })

  const highlightMask = $derived.by((): Uint8Array | null => {
    if (!recurrenceData) return null
    return buildHighlightMask(
      recurrenceData.matrix,
      recurrenceData.fixationCount,
      settings.highlight,
      settings.masking,
      settings.minLineLength
    )
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
  unavailableMessage={!engine.capabilities.spatial
    ? 'This visualization requires spatial coordinate data.'
    : null}
>
  {#snippet header()}
    <div class="plot-controls">
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
  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
