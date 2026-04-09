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
    createStimulusGroupSelects,
    PreviewModel,
    createMenuCloseHandler,
    getColorScaleCommitted,
    buildColorScalePatch,
    deriveEffectiveColorScale,
  } from '$lib/plots/shared'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getScanpathSimilarityData,
    buildScangraphData,
  } from '../core/transformer'

  import { SIMILARITY_LEGEND_TITLES } from '../const'
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
      ...getColorScaleCommitted(settings.colorScale, PRESET_PALETTES.BLUE.colors[0], PRESET_PALETTES.BLUE.colors[2]),
      minValue: currentStimulusColorRange[0],
      maxValue: currentStimulusColorRange[1],
      threshold: settings.threshold ?? 0.5,
      collapsed: settings.collapsed ?? false,
      view: settings.view ?? 'matrix',
      similarityMethod: settings.similarityMethod ?? 'levenshtein',
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<ScanpathSimilaritySettings> = {
        ...PreviewModel.buildSimplePatch(draft, committed, [
          'threshold', 'collapsed', 'view', 'similarityMethod',
        ]),
      }

      const colorScale = buildColorScalePatch(draft, committed)
      if (colorScale) updates.colorScale = colorScale

      if (draft.minValue !== committed.minValue || draft.maxValue !== committed.maxValue) {
        const ranges = [...(settings.stimuliColorValueRanges || [])]
        ranges[settings.stimulusId] = [draft.minValue, draft.maxValue]
        updates.stimuliColorValueRanges = ranges
      }

      return updates
    },
  })

  const syncs = preview.fields

  const effectiveColorScale = $derived(deriveEffectiveColorScale(preview.draft))

  const effectiveView = $derived(preview.draft.view)
  const effectiveMethod = $derived(preview.draft.similarityMethod)
  const effectiveCollapsed = $derived(preview.draft.collapsed)
  const effectiveThreshold = $derived(preview.draft.threshold)

  const source = untrack(() => createCommandSourcePlotPattern(item, 'plot'))


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

  const handleMenuClose = createMenuCloseHandler(preview, patch =>
    workspace.updateItemSettings(item.id, patch, $state.snapshot(source))
  )

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
    ...createStimulusGroupSelects(
      engine, settings.stimulusId, settings.groupId,
      id => updateSettings({ stimulusId: id }),
      id => updateSettings({ groupId: id })
    ),
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
    <div class="plot-controls">
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
          legendTitle={SIMILARITY_LEGEND_TITLES[effectiveMethod] ?? 'Similarity'}
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
