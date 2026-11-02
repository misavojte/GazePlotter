import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ModalState } from '$lib/modals/modalState.svelte'
import { exportMetricDataModal, exportSegmentedDataModal } from '$lib/modals/definitions'

type PlotScope = {
  metricInstanceIds?: string[]
  stimulusId?: number
  participantSelectionId?: number
  participantId?: number
  timelineStart?: number
  timelineEnd?: number
  aoiSelectionId?: number
  hideNoAoi?: boolean
}

export type PlotDataExport = {
  label: string
  /** The file it leads to, in a few words ("Metric CSV, preset to this plot"). */
  summary: string
  title: string
  open: () => void
}

/**
 * The data behind one plot (still editable before downloading): a metric plot
 * opens the metric CSV preset to its metrics, stimulus, participants, time crop and
 * AOI selection; a gaze plot opens the segment CSV preset to its stimulus and
 * participants. Null when the plot has neither.
 */
export function plotDataExport(
  settings: unknown,
  engine: DataEngine,
  modalState: ModalState
): PlotDataExport | null {
  const scope = settings as PlotScope
  // Exports preset the selection only: the empty-participant filter is per stimulus.
  const { participantSelectionId } = scope
  if (scope.metricInstanceIds?.length) {
    return {
      label: 'Download data',
      summary: 'Metric CSV, preset to this plot',
      title: `Metric CSV, preset to this plot's ${[
        'metrics',
        scope.stimulusId !== undefined && 'stimulus',
        'participants',
        (scope.timelineStart || scope.timelineEnd) && 'time crop',
        scope.aoiSelectionId && 'AOI selection',
        scope.hideNoAoi && 'hidden No AOI',
      ]
        .filter(Boolean)
        .join(', ')}`,
      open: () =>
        modalState.open(exportMetricDataModal, {
          metricInstanceIds: scope.metricInstanceIds,
          stimulusId: scope.stimulusId,
          participantSelectionId,
          timeStart: scope.timelineStart,
          timeEnd: scope.timelineEnd,
          aoiSelectionId: scope.aoiSelectionId,
          hideNoAoi: scope.hideNoAoi,
        }),
    }
  }
  if (scope.stimulusId !== undefined && engine.hasCapabilities(['segmented'])) {
    return {
      label: 'Download segments',
      summary: 'Segment CSV, preset to this plot',
      title: `Segment CSV, preset to this plot's ${[
        'stimulus',
        'participants',
        scope.aoiSelectionId && 'AOI selection',
      ]
        .filter(Boolean)
        .join(', ')} (whole recordings)`,
      open: () =>
        modalState.open(exportSegmentedDataModal, {
          stimulusId: scope.stimulusId,
          participantSelectionId,
          participantId: scope.participantId,
          aoiSelectionId: scope.aoiSelectionId,
        }),
    }
  }
  return null
}
