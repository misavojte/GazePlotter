<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import ChevronLeft from 'lucide-svelte/icons/chevron-left'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'
  import { InputNumber, Select, ButtonPreset } from '$lib/shared/components'
  import {
    ModalButtons,
    CheckboxListField,
    Step,
    StepList,
    HelpText,
    FieldGrid,
  } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getPlotDisplayName, getPlotSubtitle } from '$lib/plots/registry'
  import type { PlotView } from '$lib/plots/definePlot'
  import type { AllGridTypes } from '$lib/workspace/grid'
  import {
    canvasToBlobWithWhiteBackground,
    getMimeType,
    getQuality,
    type ExportFileType,
  } from '$lib/data/export'
  import {
    createExportButtons,
    listSummary,
    mapSelectableItems,
    toggleSetValue,
    withExportBusy,
    DEFAULT_CANVAS_EXPORT_MARGIN,
    DPI_PRESET_OPTIONS,
    IMAGE_TYPE_OPTIONS,
  } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'
  import ExportProgressBar from '../shared/ExportProgressBar.svelte'
  import FigureRenderHost from './FigureRenderHost.svelte'
  import FigurePreview from './FigurePreview.svelte'
  import type { PlotExportProps } from './types'
  import { deriveItemView, itemExportProps } from './view'
  import { buildFigureEntryName } from './naming'

  /**
   * The single figure exporter: one cardinality-agnostic dialog for one plot,
   * a selection, or the whole workspace. Entry points differ only in the
   * preseeded selection (plot pane: that plot; bulk pane: the selection;
   * export hub: everything).
   */
  export interface Props {
    /** Prefill: preselect these grid items. Read once by design. */
    itemIds?: number[]
  }

  let { itemIds }: Props = $props()
  const { engine, exportService, errorService, grid, modalState } =
    getGazePlotterSession()

  // Reading order (top-to-bottom, left-to-right) — the order figures are
  // numbered in the archive.
  const orderedItems = $derived(
    [...grid.items].sort((a, b) => a.y - b.y || a.x - b.x)
  )

  // Seeded once by design: an explicit prefill wins, then the workspace
  // selection, then everything.
  let selectedIds = $state(
    untrack(() => {
      const base =
        itemIds && itemIds.length > 0
          ? grid.items.filter(item => itemIds.includes(item.id))
          : grid.selectedItems.length > 0
            ? grid.selectedItems
            : grid.items
      return new Set(base.map(item => String(item.id)))
    })
  )

  let fileType = $state<ExportFileType>('.png')
  let dpi = $state(300)
  let margin = $state(DEFAULT_CANVAS_EXPORT_MARGIN)
  let isExporting = $state(false)

  function subtitleValues(item: AllGridTypes): string[] {
    const parts = getPlotSubtitle(item, engine) ?? []
    return parts.map(part => part.value)
  }

  const figureListItems = $derived(
    mapSelectableItems(
      orderedItems.map(item => ({
        value: String(item.id),
        label: getPlotDisplayName(item.type),
        sublabel: subtitleValues(item).join(' · '),
      })),
      selectedIds
    )
  )

  const selectedItemsInOrder = $derived(
    orderedItems.filter(item => selectedIds.has(String(item.id)))
  )

  // ── Collapsed-header selection summaries ───────────────────────────────────
  const figuresSummary = $derived.by(() => {
    const count = selectedItemsInOrder.length
    const single =
      count === 1 ? getPlotDisplayName(selectedItemsInOrder[0].type) : undefined
    return listSummary(count, orderedItems.length, single)
  })

  const outputSummary = $derived(
    `${fileType === '.png' ? 'PNG' : 'JPG'} · ${dpi} DPI`
  )

  // ── Step completion ─────────────────────────────────────────────────────────
  const dpiValid = $derived(Number.isFinite(dpi) && dpi >= 72)
  const marginValid = $derived(Number.isFinite(margin) && margin >= 0)
  const stepFiguresDone = $derived(selectedItemsInOrder.length > 0)
  const stepOutputDone = $derived(dpiValid && marginValid)
  const canExport = $derived(stepFiguresDone && stepOutputDone)

  // A single figure downloads as a bare image named after its plot; several
  // bundle into a ZIP.
  const exportFileName = $derived(
    selectedItemsInOrder.length === 1
      ? `GazePlotter-${getPlotDisplayName(selectedItemsInOrder[0].type).replace(/\s+/g, '')}`
      : 'GazePlotter-Figures'
  )

  // ── Preview paging ──────────────────────────────────────────────────────────
  let previewIndex = $state(0)
  const previewCount = $derived(selectedItemsInOrder.length)
  const clampedPreviewIndex = $derived(
    Math.max(0, Math.min(previewIndex, previewCount - 1))
  )
  const previewItem = $derived(
    previewCount > 0 ? selectedItemsInOrder[clampedPreviewIndex] : null
  )

  const previewSummary = $derived(
    previewCount === 0
      ? 'Nothing to preview'
      : previewCount === 1
        ? '1 figure ready'
        : `${previewCount} figures ready`
  )

  // ── Sequential off-screen rendering ─────────────────────────────────────────
  type RenderJob = {
    view: PlotView
    exportProps: PlotExportProps
    resolve: (canvas: HTMLCanvasElement | null) => void
  }

  // $state.raw: the job carries the figure's data props (possibly large object
  // arrays) and is only ever reassigned wholesale — deep-proxying it would tax
  // every draw-loop read.
  let renderJob = $state.raw<RenderJob | null>(null)
  let exportProgress = $state<{
    position: number
    total: number
    name: string
  } | null>(null)
  let cancelled = false

  // Closing the modal mid-export (Cancel, Escape) abandons the batch: no file,
  // no toast.
  onDestroy(() => {
    cancelled = true
  })

  function renderFigure(
    view: PlotView,
    exportProps: PlotExportProps
  ): Promise<HTMLCanvasElement | null> {
    return new Promise(resolve => {
      renderJob = {
        view,
        exportProps,
        resolve: canvas => {
          renderJob = null
          resolve(canvas)
        },
      }
    })
  }

  // Exporting off implies no in-flight progress or render job.
  const setExporting = (exporting: boolean) => {
    isExporting = exporting
    if (!exporting) {
      exportProgress = null
      renderJob = null
    }
  }

  const handleExport = async () => {
    if (!canExport || isExporting) return

    const items = selectedItemsInOrder
    const fileName = exportFileName
    const mimeType = getMimeType(fileType)
    const quality = getQuality(fileType)
    const files: Array<{ name: string; content: Blob }> = []

    await withExportBusy(setExporting, async () => {
      for (let i = 0; i < items.length; i++) {
        if (cancelled) return
        const item = items[i]
        const name = getPlotDisplayName(item.type)
        exportProgress = { position: i + 1, total: items.length, name }

        try {
          const view = deriveItemView(engine, item)
          const canvas = view
            ? await renderFigure(view, itemExportProps(item, grid, dpi, margin))
            : null
          if (cancelled) return
          if (!canvas) {
            errorService.report({
              origin: 'export',
              severity: 'recoverable',
              userMessage: `${name} has nothing to draw and was left out of the export.`,
              cause: new Error(
                `Figure render produced no canvas for plot type ${item.type}`
              ),
              context: { fileName, fileType, dpi },
            })
            continue
          }
          const blob = await canvasToBlobWithWhiteBackground(
            canvas,
            mimeType,
            quality
          )
          files.push({
            name: buildFigureEntryName({
              position: i + 1,
              total: items.length,
              name,
              qualifiers: subtitleValues(item),
              extension: fileType,
            }),
            content: blob,
          })
        } catch (error) {
          errorService.report({
            origin: 'export',
            severity: 'recoverable',
            userMessage: `Could not render ${name}; it was left out of the export.`,
            cause: error,
            context: { fileName, fileType, dpi },
          })
        }
      }

      if (cancelled) return
      await exportService.exportFigures({
        fileName,
        files,
        requestedCount: items.length,
      })
    })
  }

  const exportButtons = $derived(
    createExportButtons({
      canExport,
      exportLabel: `Export ${selectedItemsInOrder.length === 1 ? 'Figure' : `${selectedItemsInOrder.length} Figures`}`,
      isExporting,
      onCancel: () => modalState.close(),
      onExport: handleExport,
    })
  )
</script>

<ExportShell
  intro="Export workspace figures as publication-ready images. A single figure downloads directly; several bundle into a ZIP archive."
>
  <StepList>
    <Step
      n={1}
      title="Choose figures"
      description="Figures are numbered in workspace order, top to bottom."
      summary={figuresSummary}
      done={stepFiguresDone}
    >
      <CheckboxListField
        title="Figures"
        items={figureListItems}
        onItemChange={(key, checked) => {
          selectedIds = toggleSetValue(selectedIds, key, checked)
        }}
        hasError={!stepFiguresDone}
        errorMessage="Select at least one figure to export"
      />
    </Step>

    <Step
      n={2}
      title="Configure the output"
      description="Each figure keeps its current workspace size and proportions; the resolution scales the output pixels. Resize a plot in the workspace to change its exported size."
      summary={outputSummary}
      done={stepOutputDone}
    >
      <FieldGrid>
        <Select
          label="Image format"
          options={IMAGE_TYPE_OPTIONS}
          bind:value={fileType}
        />
        <InputNumber label="Margin [px]" bind:value={margin} min={0} />
        <InputNumber label="Resolution [DPI]" bind:value={dpi} min={72} />
      </FieldGrid>
      <div class="dpi-presets">
        <span class="presets-label">DPI Presets:</span>
        {#each DPI_PRESET_OPTIONS as preset (preset.value)}
          <ButtonPreset
            label={preset.label}
            isActive={dpi === preset.value}
            onclick={() => (dpi = preset.value)}
          />
        {/each}
      </div>
      {#if !dpiValid}
        <HelpText tone="error">Resolution must be at least 72 DPI</HelpText>
      {/if}
      {#if !marginValid}
        <HelpText tone="error"
          >Margin must be zero or a positive number of pixels</HelpText
        >
      {/if}
    </Step>

    <Step
      n={3}
      title="Preview"
      description="Each figure exactly as it will export, scaled to fit. The caption states the real output size in pixels and print size at the chosen resolution."
      summary={previewSummary}
      done={stepFiguresDone && stepOutputDone}
      last
    >
      {#if previewItem}
        {#if previewCount > 1}
          <div class="preview-pager">
            <button
              type="button"
              class="pager-btn"
              aria-label="Previous figure"
              disabled={clampedPreviewIndex === 0}
              onclick={() => (previewIndex = clampedPreviewIndex - 1)}
            >
              <ChevronLeft size={'1em'} strokeWidth={1} />
            </button>
            <span class="preview-pager-label">
              {clampedPreviewIndex + 1} of {previewCount} ·
              {getPlotDisplayName(previewItem.type)}
              {#if subtitleValues(previewItem).length > 0}
                <span class="preview-pager-detail">
                  {subtitleValues(previewItem).join(' · ')}
                </span>
              {/if}
            </span>
            <button
              type="button"
              class="pager-btn"
              aria-label="Next figure"
              disabled={clampedPreviewIndex >= previewCount - 1}
              onclick={() => (previewIndex = clampedPreviewIndex + 1)}
            >
              <ChevronRight size={'1em'} strokeWidth={1} />
            </button>
          </div>
        {/if}
        <FigurePreview item={previewItem} {dpi} {margin} />
      {:else}
        <HelpText>Select at least one figure to preview.</HelpText>
      {/if}
    </Step>
  </StepList>

  <ExportProgressBar
    progress={exportProgress
      ? {
          position: exportProgress.position,
          total: exportProgress.total,
          name: `Rendering figure ${exportProgress.name}`,
        }
      : null}
  />

  <ModalButtons buttons={exportButtons} />
</ExportShell>

{#if renderJob}
  <FigureRenderHost
    view={renderJob.view}
    exportProps={renderJob.exportProps}
    onResult={renderJob.resolve}
  />
{/if}

<style>
  .dpi-presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }

  .presets-label {
    font-size: 0.8rem;
    color: var(--c-darkgrey);
  }

  .preview-pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .preview-pager-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--c-text);
    text-align: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-pager-detail {
    font-weight: 400;
    color: var(--c-darkgrey);
  }

  .pager-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    background: none;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    color: var(--c-black);
    font-size: 15px;
    cursor: pointer;
    transition:
      background-color var(--transition-fast) ease,
      color var(--transition-fast) ease;
  }

  .pager-btn:hover:not(:disabled) {
    color: var(--c-brand);
    background: var(--c-darkwhite);
  }

  .pager-btn:disabled {
    cursor: not-allowed;
    color: var(--c-darkgrey);
    background: var(--c-lightgrey);
  }
</style>
