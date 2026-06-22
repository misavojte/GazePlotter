import { describe, expect, it } from 'vitest'
import { createRailItems, type RailVisualization } from '$lib/workspace/rail/config'
import { PLOT_GROUPS } from '$lib/plots/groups'
import { plotRegistry } from '$lib/plots/registry'

const baseOptions = {
  undoLabel: null,
  redoLabel: null,
  canUndo: false,
  canRedo: false,
  isProcessing: false,
  isValidData: true,
  onUndo: () => {},
  onRedo: () => {},
  onResetLayout: () => {},
}

function addVisualizationActions(
  visualizations: RailVisualization[],
  onAddVisualization: (id: string) => void = () => {}
) {
  const items = createRailItems({
    ...baseOptions,
    visualizations,
    onAddVisualization,
  })
  const addItem = items.find(i => i.id === 'add-visualization')
  expect(addItem).toBeDefined()
  return addItem!.actions
}

describe('add-visualization menu grouping', () => {
  it('groups plots into submenus ordered by PLOT_GROUPS, dropping empty groups', () => {
    const actions = addVisualizationActions([
      { id: 'a', label: 'A', group: 'per-aoi' },
      { id: 'b', label: 'B', group: 'gaze-behavior' },
      { id: 'c', label: 'C', group: 'per-aoi' },
    ])

    // gaze-behavior precedes per-aoi in PLOT_GROUPS; the three unused groups drop.
    expect(actions.map(a => a.label)).toEqual(['Gaze behavior', 'Per AOI'])
    expect(actions[0].children?.map(c => c.label)).toEqual(['B'])
    expect(actions[1].children?.map(c => c.label)).toEqual(['A', 'C'])
  })

  it('makes group parents pure submenu openers and leaves the run on the leaves', () => {
    const added: string[] = []
    const actions = addVisualizationActions(
      [{ id: 'scarf', label: 'Scarf Plot', group: 'gaze-behavior' }],
      id => added.push(id)
    )

    expect(actions).toHaveLength(1)
    expect(actions[0].run).toBeUndefined()
    actions[0].children?.[0].run?.()
    expect(added).toEqual(['scarf'])
  })

  it('places every registered plot under exactly one known group', () => {
    const visualizations: RailVisualization[] = Object.entries(plotRegistry).map(
      ([id, config]) => ({ id, label: config.name, group: config.group })
    )
    const actions = addVisualizationActions(visualizations)

    const flattened = actions.flatMap(a => a.children ?? [])
    expect(flattened).toHaveLength(visualizations.length)

    const groupLabels = new Set(PLOT_GROUPS.map(g => g.label))
    for (const action of actions) expect(groupLabels.has(action.label)).toBe(true)
  })

  it('lays out the current taxonomy as expected', () => {
    const visualizations: RailVisualization[] = Object.entries(plotRegistry).map(
      ([id, config]) => ({ id, label: config.name, group: config.group })
    )
    const layout = addVisualizationActions(visualizations).map(a => [
      a.label,
      a.children?.map(c => c.label),
    ])

    expect(layout).toEqual([
      ['Gaze behavior', ['Scarf Plot', 'Scanpath', 'Recurrence Plot']],
      ['Per AOI', ['AOI Comparison', 'AOI Timeline']],
      ['Inter-AOI', ['Transition Matrix']],
      ['Per participant', ['Metric Timeline', 'Metric Correlation']],
      ['Inter-participant', ['Scanpath Similarity']],
    ])
  })
})
