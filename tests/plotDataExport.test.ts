import { describe, expect, it } from 'vitest'
import { createGazePlotterSession } from '$lib/session'
import { exportMetricDataModal } from '$lib/modals/definitions'
import { plotDataExport } from '$lib/workspace/pane/dataExport'

// One helper behind the pane's link and the plot's right-click item.
describe('a plot\'s data export', () => {
  it('opens the metric export preset to the plot, "Non-empty" widened to everyone', () => {
    const { engine, modalState } = createGazePlotterSession()
    const data = plotDataExport(
      { metricInstanceIds: ['m'], stimulusId: 1, groupId: -2, aoiSelectionId: 3, hideNoAoi: true },
      engine,
      modalState
    )!
    expect(data.label).toBe('Download data')
    expect(data.title).toBe(
      "Metric CSV, preset to this plot's metrics, stimulus, participants, AOI selection, hidden No AOI"
    )
    void data.open()
    expect(modalState.activeModal?.definition).toEqual(exportMetricDataModal)
    expect(modalState.activeModal?.props).toMatchObject({
      metricInstanceIds: ['m'],
      stimulusId: 1,
      groupId: undefined,
      aoiSelectionId: 3,
      hideNoAoi: true,
    })
  })

  it('offers nothing for a plot without metrics on a dataset without segments', () => {
    const { engine, modalState } = createGazePlotterSession()
    expect(plotDataExport({ stimulusId: 0 }, engine, modalState)).toBeNull()
  })
})
