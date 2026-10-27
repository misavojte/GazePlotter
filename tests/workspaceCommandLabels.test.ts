import { describe, expect, it } from 'vitest'
import { getCommandLabel, getSuccessLabel } from '$lib/workspace/commands/labels'
import type { MetricInstance } from '$lib/metrics'

describe('getCommandLabel', () => {
  it('names a stimulus-only settings edit, and nothing broader', () => {
    const settings = (s: Record<string, unknown>) => ({
      type: 'updateSettings' as const,
      updates: [{ itemId: 1, settings: s }],
      source: 'scarf.1.workspace',
    })
    expect(getCommandLabel(settings({ stimulusId: 2 }), 'undone')).toBe(
      'Undone: stimulus change'
    )
    expect(
      getCommandLabel(settings({ stimulusId: 2, participantSelectionId: 1 }), 'undone')
    ).toBe('Undone: plot update')
    expect(getCommandLabel(settings({ participantSelectionId: 1 }), 'redone')).toBe(
      'Redone: plot update'
    )
  })
})

describe('getSuccessLabel', () => {
  const metric = (id: string, label: string, extra = {}) =>
    ({ id, baseId: 'fixationCount', label, ...extra }) as unknown as MetricInstance
  const library = (instances: MetricInstance[]) => ({
    type: 'updateMetricInstances' as const,
    instances,
    source: 'metricLibrary.modal',
  })
  const a = metric('a', 'Fixations')
  const b = metric('b', 'Dwell')

  it('names the one metric a library change added, removed or edited', () => {
    expect(getSuccessLabel(library([a, b]), library([a]))).toBe('Added metric "Dwell"')
    expect(getSuccessLabel(library([a]), library([a, b]))).toBe('Removed metric "Dwell"')
    expect(
      getSuccessLabel(library([a, metric('b', 'Dwell', { params: { x: 1 } })]), library([a, b]))
    ).toBe('Updated metric "Dwell"')
  })

  it('falls back to the generic label for broader changes', () => {
    expect(getSuccessLabel(library([]), library([a, b]))).toBe('Metric library updated')
    expect(getSuccessLabel(library([a]), null)).toBe('Metric library updated')
  })
})
