import { expect, test } from 'vitest'
import {
  convertVisibilityIntervalsToEvents,
  groupEventChannelsByDisplayedName,
} from '$lib/plots/scarf'

test('Relative: single interval produces start and end events', () => {
  const events = convertVisibilityIntervalsToEvents([1000, 5000], 0, 6000, 6000)

  expect(events.length).toBe(2)
  expect(events[0].type).toBe(0)
  expect(events[1].type).toBe(1)
  expect(events[0].x).toBeCloseTo(1000 / 6000)
  expect(events[1].x).toBeCloseTo(5000 / 6000)
})

test('Absolute: single interval produces start and end events', () => {
  const events = convertVisibilityIntervalsToEvents([1000, 5000], 0, 6000, 6000)

  expect(events.length).toBe(2)
  expect(events[0].type).toBe(0)
  expect(events[1].type).toBe(1)
  expect(events[0].x).toBeCloseTo(1000 / 6000)
  expect(events[1].x).toBeCloseTo(5000 / 6000)
})

test('Open-ended interval produces start-only event', () => {
  const events = convertVisibilityIntervalsToEvents([1000], 0, 6000, 6000)
  expect(events.length).toBe(1)
  expect(events[0].type).toBe(0)
  expect(events[0].x).toBeCloseTo(1000 / 6000)
})

test('Intervals outside range are ignored (absolute)', () => {
  const events = convertVisibilityIntervalsToEvents([7000, 8000], 0, 6000, 6000)
  expect(events.length).toBe(0)
})

test('Event channels are grouped by displayed name for scarf visibility', () => {
  const grouped = groupEventChannelsByDisplayedName([
    {
      id: 10,
      originalName: 'Hit_A',
      displayedName: 'Hit',
      color: '#ff0000',
    },
    {
      id: 11,
      originalName: 'Miss',
      displayedName: '',
      color: '#00ff00',
    },
    {
      id: 12,
      originalName: 'Hit_B',
      displayedName: 'Hit',
      color: '#0000ff',
    },
  ])

  expect(grouped.map(g => g.id)).toEqual([10, 11])
  expect(grouped[0].memberIds).toEqual([10, 12])
  expect(grouped[0].displayedName).toBe('Hit')
  expect(grouped[0].color).toBe('#ff0000')
  expect(grouped[1].memberIds).toEqual([11])
})
