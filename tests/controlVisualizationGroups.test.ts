import { describe, expect, it } from 'vitest'
import { createToolControls, type ControlVisualization } from '$lib/workspace/controls/config'
import { PLOT_GROUPS } from '$lib/plots/groups'
import { PLOT_GLYPHS } from '$lib/plots/glyphs'
import { plotRegistry } from '$lib/plots/registry'
import type { PlotType } from '$lib/workspace/grid/types'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { addablePlots } from '$lib/workspace/controls/addPlot'

const allVisualizations = (): ControlVisualization[] =>
  (Object.keys(plotRegistry) as PlotType[]).map(id => ({
    id,
    label: plotRegistry[id].name,
    group: plotRegistry[id].group,
  }))

const baseOptions = {
  undoLabel: null,
  redoLabel: null,
  canUndo: false,
  canRedo: false,
  isProcessing: false,
  isValidData: true,
  onUndo: () => {},
  onRedo: () => {},
}

function addVisualizationActions(
  visualizations: ControlVisualization[],
  onAddVisualization: (id: string) => void = () => {}
) {
  const items = createToolControls({
    ...baseOptions,
    visualizations,
    onAddVisualization,
  })
  const addItem = items.find(i => i.id === 'add-visualization')
  expect(addItem).toBeDefined()
  return addItem!.actions
}

describe('add-visualization menu', () => {
  it('lists plots flat under a heading per group, in PLOT_GROUPS order, dropping empty groups', () => {
    const actions = addVisualizationActions([
      { id: 'aoiComparison', label: 'A', group: 'metric' },
      { id: 'scarf', label: 'B', group: 'sequence' },
      { id: 'aoiStreamPlot', label: 'C', group: 'metric' },
    ])

    expect(actions.map(a => [a.label, a.heading ?? false])).toEqual([
      ['Sequences', true],
      ['B', false],
      ['Metrics', true],
      ['A', false],
      ['C', false],
    ])
    expect(actions.some(a => a.children)).toBe(false)
  })

  it('moves plots the dataset cannot feed to a last section, disabled, with the reason', () => {
    const added: string[] = []
    const actions = addVisualizationActions(
      [
        { id: 'eventComparison', label: 'Event Comparison', detail: 'A metric per event channel', group: 'metric', unavailable: 'Needs event data' },
        { id: 'scarf', label: 'Scarf Plot', detail: 'AOI sequence', group: 'sequence', keywords: 'sequence chart' },
      ],
      id => added.push(id)
    )
    expect(actions.map(a => a.label)).toEqual(['Sequences', 'Scarf Plot', 'Not available for this data', 'Event Comparison'])

    const event = actions.find(a => a.label === 'Event Comparison')!
    expect(event.disabled).toBe(true)
    expect(event.disabledReason).toBe('Needs event data')

    const scarf = actions.find(a => a.label === 'Scarf Plot')!
    expect(scarf.disabled).toBe(false)
    expect(scarf.keywords).toBe('AOI sequence sequence chart')
    scarf.run?.()
    expect(added).toEqual(['scarf'])
  })

  it('marks Scanpath and Fixation Heatmap unavailable without fixation coordinates', () => {
    const engine = {
      hasCapabilities: (reqs: unknown[] = []) =>
        reqs.every(r => (Array.isArray(r) ? r : [r]).some(k => k === 'segmented')),
    } as unknown as DataEngine
    const unavailable = addablePlots(engine).filter(v => v.unavailable).map(v => [v.id, v.unavailable])
    expect(unavailable).toEqual([
      ['fixationHeatmap', 'Needs fixation coordinates'],
      ['scanpath', 'Needs fixation coordinates'],
      ['eventComparison', 'Needs event data'],
    ])
  })

  it('gives every registered plot a group and a thumbnail', () => {
    const actions = addVisualizationActions(allVisualizations())
    const plots = actions.filter(a => !a.heading)
    expect(plots).toHaveLength(Object.keys(plotRegistry).length)
    for (const plot of plots) expect(plot.thumbnail).toMatch(/^<svg viewBox="0 0 48 32"/)
    for (const id of Object.keys(plotRegistry) as PlotType[]) expect(PLOT_GLYPHS[id]).toBeTruthy()

    const groupLabels = new Set(PLOT_GROUPS.map(g => g.label))
    for (const heading of actions.filter(a => a.heading)) expect(groupLabels.has(heading.label)).toBe(true)
  })

  it('lays out the current sections as expected', () => {
    const layout: [string, string[]][] = []
    for (const action of addVisualizationActions(allVisualizations())) {
      if (action.heading) layout.push([action.label, []])
      else layout[layout.length - 1][1].push(action.label)
    }

    expect(layout).toEqual([
      ['Where they looked', ['Fixation Heatmap', 'Scanpath']],
      ['Sequences', ['Scarf Plot', 'Transition Matrix', 'Recurrence Plot', 'Scanpath Similarity']],
      [
        'Metrics',
        ['AOI Comparison', 'AOI Timeline', 'Eye-movement Comparison', 'Event Comparison', 'Metric Timeline', 'Metric Matrix', 'Metric Correlation'],
      ],
    ])
  })
})
