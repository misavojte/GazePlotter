<script lang="ts">
  import { untrack } from 'svelte'
  import { createMenuComponentItem } from '$lib/context-menu'
  import { getGazePlotterSession } from '$lib/session'

  import SimilarityMatrixFigure from './SimilarityMatrixFigure.svelte'
  import ScangraphFigure from './ScangraphFigure.svelte'
  import ScanpathSimilarityButtonMenu from './ScanpathSimilarityButtonMenu.svelte'
  import ScanpathSimilarityViewSettings from './ScanpathSimilarityViewSettings.svelte'

  import { BasePlot } from '$lib/plots/shared/components'
  import GroupSelect from '$lib/shared/components/GroupSelect.svelte'
  import type { GroupSelectItem } from '$lib/shared/components'

  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
    PreviewModel,
  } from '$lib/plots/shared'
  import { interpolateColor } from '$lib/color/utility'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getScanpathSimilarityData,
    buildScangraphData,
  } from '../core/transformer'

  import type {
    ScanpathSimilarityItem,
    ScanpathSimilaritySettings,
    SimilarityMethod,
    ScanpathSimilarityView,
  } from '../types'

  interface Props {
    item: ScanpathSimilarityItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const currentStimulusColorRange = $derived(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )

  type SimilarityPreview = {
    colorMin: string
    colorMiddle: string
    colorMax: string
    minValue: number
    maxValue: number
    threshold: number
    collapsed: boolean
    view: ScanpathSimilarityView
    similarityMethod: SimilarityMethod
  }

  const preview = new PreviewModel<
    SimilarityPreview,
    Partial<ScanpathSimilaritySettings>
  >({
    getCommitted: () => ({
      colorMin: settings.colorScale?.[0] || PRESET_PALETTES.BLUE.colors[0],
      colorMax:
        settings.colorScale?.length === 3
          ? settings.colorScale[2]
          : settings.colorScale?.[1] || PRESET_PALETTES.BLUE.colors[2],
      colorMiddle:
        settings.colorScale?.length === 3
          ? settings.colorScale[1]
          : interpolateColor(
              settings.colorScale?.[0] || PRESET_PALETTES.BLUE.colors[0],
              settings.colorScale?.[1] || PRESET_PALETTES.BLUE.colors[2],
              0.5
            ),
      minValue: currentStimulusColorRange[0],
      maxValue: currentStimulusColorRange[1],
      threshold: settings.threshold ?? 0.5,
      collapsed: settings.collapsed ?? false,
      view: settings.view ?? 'matrix',
      similarityMethod: settings.similarityMethod ?? 'levenshtein',
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<ScanpathSimilaritySettings> = {}

      const colorChanged =
        draft.colorMin !== committed.colorMin ||
        draft.colorMiddle !== committed.colorMiddle ||
        draft.colorMax !== committed.colorMax
      if (colorChanged) {
        const autoMiddle = interpolateColor(draft.colorMin, draft.colorMax, 0.5)
        updates.colorScale =
          draft.colorMiddle === autoMiddle
            ? [draft.colorMin, draft.colorMax]
            : [draft.colorMin, draft.colorMiddle, draft.colorMax]
      }

      if (
        draft.minValue !== committed.minValue ||
        draft.maxValue !== committed.maxValue
      ) {
        const ranges = [...(settings.stimuliColorValueRanges || [])]
        ranges[settings.stimulusId] = [draft.minValue, draft.maxValue]
        updates.stimuliColorValueRanges = ranges
      }

      if (draft.threshold !== committed.threshold) {
        updates.threshold = draft.threshold
      }

      if (draft.collapsed !== committed.collapsed) {
        updates.collapsed = draft.collapsed
      }

      if (draft.view !== committed.view) {
        updates.view = draft.view
      }

      if (draft.similarityMethod !== committed.similarityMethod) {
        updates.similarityMethod = draft.similarityMethod
      }

      return updates
    },
  })

  const syncs = preview.fields

  const effectiveColorScale = $derived.by(() => {
    const draft = preview.draft
    const min = draft.colorMin
    const middle = draft.colorMiddle
    const max = draft.colorMax
    const autoMiddle = interpolateColor(min, max, 0.5)
    if (middle === autoMiddle) return [min, max]
    return [min, middle, max]
  })

  const effectiveView = $derived(preview.draft.view)
  const effectiveMethod = $derived(preview.draft.similarityMethod)
  const effectiveCollapsed = $derived(preview.draft.collapsed)
  const effectiveThreshold = $derived(preview.draft.threshold)

  const source = untrack(() => createCommandSourcePlotPattern(item, 'plot'))

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  // Compute similarity data
  const similarityData = $derived.by(() => {
    return getScanpathSimilarityData(
      engine,
      settings.stimulusId,
      settings.groupId,
      effectiveMethod,
      effectiveCollapsed
    )
  })

  // Build scangraph from similarity data when in graph view
  const scangraphData = $derived.by(() => {
    if (effectiveView !== 'scangraph') return null
    return buildScangraphData(similarityData, effectiveThreshold)
  })

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

  function updateSettings(updates: Partial<typeof settings>) {
    workspace.updateItemSettings(item.id, updates, source)
  }

  const handleNodeClick = (nodeIndex: number) => {
    const current = settings.participantHighlights ?? []
    const isHighlighted = current.includes(nodeIndex)
    const newHighlights = isHighlighted
      ? current.filter(id => id !== nodeIndex)
      : [...current, nodeIndex]
    workspace.updateItemSettings(
      item.id,
      { participantHighlights: newHighlights },
      source
    )
  }

  function previewView(value?: string) {
    if (value !== 'matrix' && value !== 'scangraph') return
    syncs.view.value = value
    return value
  }

  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: stimulusOptions,
      value: settings.stimulusId.toString(),
      onchange: (e: CustomEvent) =>
        updateSettings({ stimulusId: parseInt(e.detail) }),
    },
    {
      label: 'Group',
      options: groupOptions,
      value: settings.groupId.toString(),
      onchange: (e: CustomEvent) =>
        updateSettings({ groupId: parseInt(e.detail) }),
    },
    {
      label: 'View',
      value: effectiveView,
      onClose: handleMenuClose,
      options: [
        createMenuComponentItem({
          value: 'matrix',
          label: 'Similarity Matrix',
          onAction: previewView,
          closeOnAction: false,
          component: ScanpathSimilarityViewSettings,
          componentHeight: 310,
          componentProps: {
            syncs,
            showThreshold: false,
          },
        }),
        createMenuComponentItem({
          value: 'scangraph',
          label: 'ScanGraph',
          onAction: previewView,
          closeOnAction: false,
          component: ScanpathSimilarityViewSettings,
          componentHeight: 160,
          componentProps: {
            syncs,
            showThreshold: true,
          },
        }),
      ],
    },
  ])
</script>

<BasePlot {item} hasData={similarityData.size > 0}>
  {#snippet header()}
    <div class="controls">
      <GroupSelect
        ariaLabel="Scanpath Similarity filters"
        items={selectItems}
      />
      <div class="menu-button">
        <ScanpathSimilarityButtonMenu {item} />
      </div>
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    <div class="figure-container">
      {#if effectiveView === 'matrix'}
        <SimilarityMatrixFigure
          matrix={similarityData.matrix}
          labels={similarityData.labels}
          {width}
          {height}
          colorScale={effectiveColorScale}
          colorValueRange={[syncs.minValue.value, syncs.maxValue.value]}
        />
      {:else if effectiveView === 'scangraph' && scangraphData}
        <ScangraphFigure
          data={scangraphData}
          {width}
          {height}
          threshold={effectiveThreshold}
          highlights={settings.participantHighlights ?? []}
          onNodeClick={handleNodeClick}
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
  .menu-button {
    display: flex;
    align-items: center;
  }
  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
