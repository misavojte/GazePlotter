import type { PlotType } from '$lib/workspace/grid/types'

/**
 * Symbolic 48×32 thumbnails for the add-visualization menu, one per plot.
 *
 * Icon rules, which keep the set reading as one family:
 * - one live area (x 8..40, y 6..26) and integer geometry;
 * - three rows on a 7px pitch wherever a glyph has rows;
 * - fills in four fixed steps (Q), one corner radius;
 * - ink plus at most three AOI hues, and AOI hues only where the plot
 *   encodes AOIs;
 * - one defining idea per plot. The comparison plots share the dot-row
 *   shape and differ only by the marker that starts each row.
 *
 * Values are hand-picked, never data. Colors are fixed symbols, not the
 * dataset's AOI colors.
 */

const INK = 'var(--c-black)'
const MUTED = 'var(--c-darkgrey)'
const PAPER = 'var(--c-white)'
const AOI = ['#4f7cac', '#e0a33b', '#5ba37a']
const EVENT = '#b5527a'
const HEAT = ['#fbe0a8', '#f3a05a', '#dd4a22']
const POSITIVE = '#c0392b'
const NEGATIVE = '#2f6fae'
const Q = [0.18, 0.42, 0.7, 1]
const ROWS = [9, 16, 23]

const rect = (x: number, y: number, w: number, h: number, fill: string, opacity = 1, r = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" fill-opacity="${opacity}"/>`
const circle = (x: number, y: number, r: number, fill: string) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
const svg = (body: string) =>
  `<svg viewBox="0 0 48 32" width="48" height="32" aria-hidden="true">${body}</svg>`
const baseline = `<path d="M8 26.5 H40" stroke="${MUTED}" stroke-width="1"/>`

type Point = [number, number]

/** Quadratic smoothing through the points (midpoint joins). */
function smooth(points: Point[], start = 'M'): string {
  let d = `${start}${points[0][0]},${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    d += ` Q${x},${y} ${(x + points[i + 1][0]) / 2},${(y + points[i + 1][1]) / 2}`
  }
  const [lx, ly] = points[points.length - 1]
  return `${d} L${lx},${ly}`
}

/** Comparison family: row marker (x 8..12), spread capsule, mean tick. */
const COMPARE_RANGES = [[16, 29, 22], [22, 39, 31], [15, 24, 19]]
function compare(fill: (row: number) => string, marker: (row: number, y: number) => string): string {
  return svg(
    COMPARE_RANGES.map(([from, to, mean], i) => {
      const y = ROWS[i]
      return (
        marker(i, y) +
        rect(from, y - 2, to - from, 4, fill(i), Q[1], 2) +
        rect(mean - 1, y - 3.5, 2, 7, INK)
      )
    }).join('')
  )
}

/** Cells on a 7px pitch; `levels[r][c]` indexes Q, null leaves a gap. */
function cells(x0: number, levels: (number | null)[][], fill: (r: number, c: number) => string): string {
  let out = ''
  levels.forEach((row, r) =>
    row.forEach((level, c) => {
      if (level !== null) out += rect(x0 + c * 7, 6 + r * 7, 6, 6, fill(r, c), Q[level])
    })
  )
  return out
}

function heatmap(): string {
  const blobs: [number, number, number[]][] = [
    [19, 16, [9, 5.5, 2.5]],
    [31, 19, [7, 4, 1.8]],
    [33, 9, [4.5, 2.2]],
  ]
  // Contour bands painted outermost first across all blobs, so they merge.
  return svg(
    HEAT.map((color, band) =>
      blobs.map(([x, y, radii]) => (radii[band] ? circle(x, y, radii[band], color) : '')).join('')
    ).join('')
  )
}

function scanpath(): string {
  const fixations: [number, number, number][] = [[11, 22, 3.5], [19, 11, 2.5], [29, 19, 4.5], [37, 9, 2.5]]
  const stroke = `stroke="${AOI[0]}" stroke-width="1.5"`
  return svg(
    `<polyline points="${fixations.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" ${stroke} stroke-linejoin="round"/>` +
      fixations.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${PAPER}" ${stroke}/>`).join('')
  )
}

function scarf(): string {
  // [width, AOI] runs per participant row; widths sum to the 32px live area.
  const rows = [
    [[7, 0], [5, 1], [10, 2], [10, 0]],
    [[4, 1], [12, 0], [7, 2], [9, 1]],
    [[10, 2], [6, 0], [8, 1], [8, 2]],
  ]
  return svg(
    rows.map((runs, i) => {
      let x = 8
      return runs.map(([w, aoi], j) => {
        const gap = j < runs.length - 1 ? 1 : 0
        const out = rect(x, ROWS[i] - 2, w - gap, 4, AOI[aoi])
        x += w
        return out
      }).join('')
    }).join('')
  )
}

function transitionMatrix(): string {
  const chips = AOI.map((color, r) => rect(13, 6 + r * 7, 3, 6, color)).join('')
  return svg(chips + cells(18, [[0, 3, 1], [2, 0, 3], [1, 2, 0]], () => INK))
}

function recurrence(): string {
  // 6x6 on a 4px pitch: the main diagonal, one parallel line (a repeated
  // sequence) and one 2x2 block (dwelling in a region), mirrored.
  const marks: Point[] = [[0, 2], [1, 3], [2, 4], [3, 5], [4, 0], [5, 0], [4, 1], [5, 1]]
  const cell = (i: number, j: number, level: number) =>
    rect(12.5 + i * 4, 4.5 + (5 - j) * 4, 3, 3, INK, Q[level], 0.5)
  let out = ''
  for (let i = 0; i < 6; i++) out += cell(i, i, 3)
  for (const [i, j] of marks) out += cell(i, j, 1) + cell(j, i, 1)
  return svg(out)
}

function scanpathSimilarity(): string {
  // Two groups of similar participants, as in the ScanGraph view.
  const nodes: [number, number, string][] = [
    [12, 11, AOI[0]], [20, 21, AOI[0]], [10, 22, AOI[0]], [31, 10, AOI[2]], [38, 20, AOI[2]],
  ]
  const edges = [[0, 1], [1, 2], [0, 2], [3, 4]]
  return svg(
    `<line x1="20" y1="21" x2="31" y2="10" stroke="${MUTED}" stroke-width="1" stroke-dasharray="2 2"/>` +
      edges.map(([a, b]) =>
        `<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" stroke="${INK}" stroke-width="1.5" stroke-opacity="${Q[2]}"/>`
      ).join('') +
      nodes.map(([x, y, color]) =>
        `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" stroke="${PAPER}" stroke-width="1.5"/>`
      ).join('')
  )
}

function aoiTimeline(): string {
  // As the plot: a stream mirrored about a fixed zero line, pointed at both
  // ends, layers trading dominance over time.
  const xs = [6, 10.5, 15, 19.5, 24, 28.5, 33, 37.5, 42]
  const layers = [
    [0, 4, 6, 3, 2, 4, 3, 2, 0],
    [0, 3, 2, 5, 7, 4, 3, 2, 0],
    [0, 6, 7, 5, 3, 5, 2, 1, 0],
  ].map(layer => layer.map(v => v * 1.25))
  const total = xs.map((_, i) => layers.reduce((sum, layer) => sum + layer[i], 0))
  const bottom: Point[] = xs.map((x, i) => [x, 16 + total[i] / 2])
  const bottomPath = smooth(bottom.slice().reverse(), 'L')
  let edge = bottom.map(([, y]) => y)
  const tops = layers.map(layer => (edge = edge.map((y, i) => y - layer[i])))
  // Each layer fills from its top edge to the stream's bottom, painted top
  // layer first: neighbours then share one curve and leave no seam.
  return svg(
    tops
      .map((top, k) => `<path d="${smooth(xs.map((x, i) => [x, top[i]]))} ${bottomPath} Z" fill="${AOI[k]}"/>`)
      .reverse()
      .join('')
  )
}

function metricTimeline(): string {
  const line: Point[] = [[8, 20], [13, 14], [18, 18], [23, 10], [28, 13], [33, 21], [40, 14]]
  return svg(
    rect(20, 6, 9, 20, AOI[0], Q[0]) +
      `<path d="${smooth(line)}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
      baseline
  )
}

function metricCorrelation(): string {
  // Lower triangle; signed levels pick the diverging side.
  const levels = [[2], [3, 2], [-2, 1, 2]]
  let out = ''
  levels.forEach((row, r) =>
    row.forEach((level, c) => {
      const fill = r === c ? INK : level > 0 ? POSITIVE : NEGATIVE
      out += rect(14 + c * 7, 6 + r * 7, 6, 6, fill, Q[Math.abs(level)])
    })
  )
  return svg(out)
}

const strokeMarker = 'fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'

export const PLOT_GLYPHS: Record<PlotType, string> = {
  fixationHeatmap: heatmap(),
  scanpath: scanpath(),
  scarf: scarf(),
  transitionMatrix: transitionMatrix(),
  recurrencePlot: recurrence(),
  scanpathSimilarity: scanpathSimilarity(),
  aoiComparison: compare(row => AOI[row], (row, y) => rect(8, y - 2, 4, 4, AOI[row])),
  aoiStreamPlot: aoiTimeline(),
  // Row markers: a fixation, a saccade, a blink.
  eyeMovementComparison: compare(
    () => MUTED,
    (row, y) =>
      row === 0
        ? `<circle cx="10" cy="${y}" r="2" stroke="${INK}" ${strokeMarker}/>`
        : row === 1
          ? `<path d="M7.5 ${y} H12 M10 ${y - 2} L12 ${y} L10 ${y + 2}" stroke="${INK}" ${strokeMarker}/>`
          : `<path d="M7.5 ${y - 1} Q10 ${y + 2} 12.5 ${y - 1}" stroke="${INK}" ${strokeMarker}/>`
  ),
  // Row marker: an event interval.
  eventComparison: compare(
    () => EVENT,
    (_, y) =>
      `<path d="M8.5 ${y - 2.5} V${y + 2.5} M11.5 ${y - 2.5} V${y + 2.5}" stroke="${EVENT}" stroke-width="1"/>` +
      rect(8.5, y - 1, 3, 2, EVENT, Q[1], 0)
  ),
  evolvingMetrics: metricTimeline(),
  metricMatrix: svg(cells(7, [[0, 2, 3, 1, 2], [3, 1, 1, 3, 0], [1, 3, 0, 2, 3]], () => AOI[0])),
  metricCorrelation: metricCorrelation(),
}
