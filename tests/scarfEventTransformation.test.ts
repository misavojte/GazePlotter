import { expect, test } from 'vitest'
import { convertVisibilityIntervalsToEvents } from '$lib/plots/scarf/utils/transformations'

test('Relative: single interval produces start and end events', () => {
  const events = convertVisibilityIntervalsToEvents(
    [1000, 5000],
    true,
    6000,
    0,
    6000,
    6000
  )

  expect(events.length).toBe(2)
  expect(events[0].type).toBe(0)
  expect(events[1].type).toBe(1)
  expect(events[0].x).toBeCloseTo(1000 / 6000)
  expect(events[1].x).toBeCloseTo(5000 / 6000)
})

test('Absolute: single interval produces start and end events', () => {
  const events = convertVisibilityIntervalsToEvents(
    [1000, 5000],
    false,
    0,
    0,
    6000,
    6000
  )

  expect(events.length).toBe(2)
  expect(events[0].type).toBe(0)
  expect(events[1].type).toBe(1)
  expect(events[0].x).toBeCloseTo(1000 / 6000)
  expect(events[1].x).toBeCloseTo(5000 / 6000)
})

test('Open-ended interval produces start-only event', () => {
  const events = convertVisibilityIntervalsToEvents([1000], true, 6000, 0, 6000, 6000)
  expect(events.length).toBe(1)
  expect(events[0].type).toBe(0)
  expect(events[0].x).toBeCloseTo(1000 / 6000)
})

test('Intervals outside range are ignored (absolute)', () => {
  const events = convertVisibilityIntervalsToEvents([7000, 8000], false, 0, 0, 6000, 6000)
  expect(events.length).toBe(0)
})
