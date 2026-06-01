import { describe, expect, test } from 'vitest'
import {
  assignOverlayLanes,
  groupEventChannelsByDisplayedName,
  type OverlayEvent,
} from '$lib/plots/scarf'

describe('assignOverlayLanes (combined-mode greedy packing)', () => {
  test('empty input', () => {
    const { lanes, laneCount } = assignOverlayLanes([])
    expect(lanes).toEqual([])
    expect(laneCount).toBe(0)
  })

  test('single event → lane 0', () => {
    const { lanes, laneCount } = assignOverlayLanes([
      { start: 100, end: 500, order: 0 },
    ])
    expect(lanes).toEqual([0])
    expect(laneCount).toBe(1)
  })

  test('sequential non-overlapping events share lane 0', () => {
    const ev: OverlayEvent[] = [
      { start: 0, end: 100, order: 0 },
      { start: 100, end: 200, order: 0 },
      { start: 200, end: 300, order: 0 },
    ]
    const { lanes, laneCount } = assignOverlayLanes(ev)
    expect(lanes).toEqual([0, 0, 0])
    expect(laneCount).toBe(1)
  })

  test('two overlapping events take separate lanes', () => {
    const { lanes, laneCount } = assignOverlayLanes([
      { start: 0, end: 200, order: 0 },
      { start: 100, end: 300, order: 0 },
    ])
    expect(lanes).toEqual([0, 1])
    expect(laneCount).toBe(2)
  })

  test('three mutually overlapping events → concurrency 3', () => {
    const { laneCount } = assignOverlayLanes([
      { start: 0, end: 300, order: 0 },
      { start: 50, end: 300, order: 1 },
      { start: 100, end: 300, order: 2 },
    ])
    expect(laneCount).toBe(3)
  })

  test('lane is reused once the prior interval ends', () => {
    // A 0-100, B 50-200 (overlaps A → lane1), C 150-250 (A ended → lane0)
    const { lanes, laneCount } = assignOverlayLanes([
      { start: 0, end: 100, order: 0 },
      { start: 50, end: 200, order: 0 },
      { start: 150, end: 250, order: 0 },
    ])
    expect(lanes).toEqual([0, 1, 0])
    expect(laneCount).toBe(2)
  })

  test('type-order is the tiebreak for equal-start events (lower order → lower lane)', () => {
    // both start at 0; input order is order=2 then order=0
    const { lanes, laneCount } = assignOverlayLanes([
      { start: 0, end: 100, order: 2 },
      { start: 0, end: 100, order: 0 },
    ])
    // order=0 is packed first → lane 0; order=2 → lane 1 (in INPUT order)
    expect(lanes).toEqual([1, 0])
    expect(laneCount).toBe(2)
  })

  test('point event inside an interval needs its own lane', () => {
    // interval 0-200, point at 100 (end===start)
    const { lanes, laneCount } = assignOverlayLanes([
      { start: 0, end: 200, order: 0 },
      { start: 100, end: 100, order: 0 },
    ])
    expect(lanes).toEqual([0, 1])
    expect(laneCount).toBe(2)
  })

  test('packing is independent of input order (sorted by start internally)', () => {
    const a = assignOverlayLanes([
      { start: 300, end: 400, order: 0 },
      { start: 0, end: 100, order: 0 },
      { start: 150, end: 250, order: 0 },
    ])
    expect(a.laneCount).toBe(1) // all sequential
  })
})

test('Event channels are grouped by displayed name for overlay rendering', () => {
  const grouped = groupEventChannelsByDisplayedName([
    { id: 10, originalName: 'Hit_A', displayedName: 'Hit', color: '#ff0000' },
    { id: 11, originalName: 'Miss', displayedName: '', color: '#00ff00' },
    { id: 12, originalName: 'Hit_B', displayedName: 'Hit', color: '#0000ff' },
  ])

  expect(grouped.map(g => g.id)).toEqual([10, 11])
  expect(grouped[0].memberIds).toEqual([10, 12])
  expect(grouped[0].displayedName).toBe('Hit')
  expect(grouped[0].color).toBe('#ff0000')
  expect(grouped[1].memberIds).toEqual([11])
})
