/**
 * The SPLOM's PLOT CURSOR ring. The load-bearing pin is (a): the ring and the dot
 * must come out of ONE projection, so a future edit to either cannot move them
 * apart. The ring also reads the VECTORS, never `cell.points` — the points are
 * NaN-filtered, so a point index is not a participant row.
 */
import { describe, expect, it } from 'vitest'
import {
  createSplomCellRenderer,
  createSplomCursorRing,
} from '$lib/plots/metric-correlation/core/splom'
import type { MetricCorrelationResult } from '$lib/plots/metric-correlation/types'
import type { MatrixLayout } from '$lib/plots/shared'
// `filledArcs` = the dots (data pass), `strokedArcs` = the rings (overlay pass).
import { canvasRecorder as recorder } from './helpers/canvasRecorder'

const LAYOUT = { xOffset: 10, yOffset: 20, cellSize: 100 } as MatrixLayout

/** 3 metrics x 3 participants. p1 has a NaN on metric 2. */
function result(participantIds: readonly number[] = [11, 22, 33]): MetricCorrelationResult {
  const vectors = [
    { metricId: 'a', values: [1, 2, 3] },
    { metricId: 'b', values: [10, 20, 30] },
    { metricId: 'c', values: [100, Number.NaN, 300] },
  ]
  const cells = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const points =
        row > col
          ? vectors[col].values
              .map((x, i) => ({ x, y: vectors[row].values[i] }))
              .filter(p => !Number.isNaN(p.x) && !Number.isNaN(p.y))
          : undefined
      cells.push({ rowMetricId: 'r', colMetricId: 'c', r: 0.5, n: 3, points })
    }
  }
  return {
    metrics: vectors.map(v => ({ id: v.metricId, label: v.metricId, unit: '' })),
    vectors,
    cells,
    correlationMethod: 'pearson',
    sampleSize: 3,
    participantIds,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('splom cursor ring', () => {
  it('rings exactly where that participant dot was drawn (one projection)', () => {
    const data = result()
    const dots = recorder()
    createSplomCellRenderer(data)(dots.ctx, LAYOUT)
    const rings = recorder()
    createSplomCursorRing(data)(rings.ctx, LAYOUT, [33])

    // Participant 33 is row index 2, and has no NaN, so every lower-triangle cell
    // rings. Each ring centre must coincide with one drawn dot.
    expect(rings.strokedArcs).toHaveLength(3)
    for (const ring of rings.strokedArcs) {
      expect(
        dots.filledArcs.some(d => d.cx === ring.cx && d.cy === ring.cy)
      ).toBe(true)
    }
  })

  it('skips a cell where that participant has an incomplete pair', () => {
    const rings = recorder()
    // Participant 22 is NaN on metric 'c', so the two cells pairing c drop out.
    createSplomCursorRing(result())(rings.ctx, LAYOUT, [22])
    expect(rings.strokedArcs).toHaveLength(1)
  })

  it('draws nothing for a participant this plot does not show', () => {
    const rings = recorder()
    createSplomCursorRing(result())(rings.ctx, LAYOUT, [999])
    expect(rings.strokedArcs).toHaveLength(0)
  })

  it('rings BOTH of a cursor pair, in every cell where each has a pair', () => {
    const rings = recorder()
    // 11 (no NaN) rings 3 cells; 22 (NaN on 'c') rings 1. Never merged, never one.
    createSplomCursorRing(result())(rings.ctx, LAYOUT, [11, 22])
    expect(rings.strokedArcs).toHaveLength(4)
  })
})
