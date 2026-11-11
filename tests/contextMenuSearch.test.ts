import { describe, expect, it } from 'vitest'
import { filterMenuItems } from '$lib/context-menu/search'
import type { MenuItem } from '$lib/context-menu'

const items: MenuItem[] = [
  { isDivider: true, label: 'Where they looked' },
  { label: 'Fixation Heatmap', detail: 'Pooled fixations on the stimulus', keywords: 'heat map attention map' },
  { label: 'Scanpath', detail: 'Fixation path of one participant', keywords: 'gaze plot' },
  { isDivider: true, label: 'Metrics' },
  { label: 'AOI Comparison', detail: 'A metric per AOI', keywords: 'dwell time TTFF' },
  { isDivider: true },
  { label: 'Metric Matrix', detail: 'Metric per participant' },
]

const labels = (list: MenuItem[]) => list.map(it => it.label ?? '---')

describe('filterMenuItems', () => {
  it('returns the items unchanged for an empty query', () => {
    expect(filterMenuItems(items, '  ')).toBe(items)
  })

  it('matches label, detail and keywords, case-insensitively, keeping the section heading', () => {
    expect(labels(filterMenuItems(items, 'GAZE plot'))).toEqual(['Where they looked', 'Scanpath'])
    expect(labels(filterMenuItems(items, 'dwell'))).toEqual(['Metrics', 'AOI Comparison'])
  })

  it('needs every word, in any order', () => {
    expect(labels(filterMenuItems(items, 'map heat'))).toEqual(['Where they looked', 'Fixation Heatmap'])
    expect(filterMenuItems(items, 'heat dwell')).toEqual([])
  })

  it('drops plain dividers and headings of sections without a match', () => {
    expect(labels(filterMenuItems(items, 'metric'))).toEqual(['Metrics', 'AOI Comparison', 'Metric Matrix'])
  })
})
