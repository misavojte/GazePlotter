import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import RecurrencePlotFigure from '../components/RecurrencePlotFigure.svelte'
import { getRecurrenceData } from './transformer'
import { buildHighlightMask } from './highlightMask'
import type { RecurrencePlotSettings } from '../types'

export type RecurrenceFigureProps = Omit<
  ComponentProps<typeof RecurrencePlotFigure>,
  keyof CanvasExportProps
>

/**
 * Single source of truth for "what a recurrence plot draws". Applies the
 * no-spatial-data fallback (`recurrenceMethod: 'aoi'`) so screen and export
 * agree — previously the export path skipped this fallback. Returns null when
 * there's no recurrence data to draw.
 */
export function getRecurrenceView(
  engine: DataEngine,
  settings: RecurrencePlotSettings
): { props: RecurrenceFigureProps } | null {
  const effectiveSettings = engine.capabilities.spatial
    ? settings
    : { ...settings, recurrenceMethod: 'aoi' as const }
  const data = getRecurrenceData(engine, effectiveSettings)
  if (!data) return null
  const highlightMask = buildHighlightMask(
    data.matrix,
    data.fixationCount,
    effectiveSettings.highlight,
    effectiveSettings.masking,
    effectiveSettings.minLineLength
  )
  return {
    props: {
      data,
      highlight: effectiveSettings.highlight,
      masking: effectiveSettings.masking,
      highlightMask,
    },
  }
}

export function deriveRecurrenceView(
  engine: DataEngine,
  settings: RecurrencePlotSettings
): PlotView | null {
  const v = getRecurrenceView(engine, settings)
  return v ? { component: RecurrencePlotFigure, props: v.props as Record<string, unknown> } : null
}
