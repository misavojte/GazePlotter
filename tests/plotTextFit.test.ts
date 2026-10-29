/**
 * Canvas text never leaves the canvas: every gutter is carved from the text it
 * holds, so these pins check the drawn extents against the canvas bounds for
 * long and short labels, wide and narrow canvases.
 */
import { describe, expect, it } from 'vitest'
import {
  axisTitleLineHeight,
  computeGradientLegendGeometry,
  computeMatrixLayout,
  FONT_PRIMARY,
  MATRIX_LAYOUT,
  PLOT_TICK_LABEL_GAP,
  ROW_LABEL_GAP,
  rowLabelColumn,
  truncatedAxisLabel,
} from '$lib/plots/shared'
import { resolveFrameLayout } from '$lib/plots/shared/usePlot.svelte'
import { estimateTextWidth } from '$lib/shared/textMeasure'

const width = (text: string, size: number = FONT_PRIMARY.SIZE) =>
  estimateTextWidth(text, size, FONT_PRIMARY.FAMILY)

const LONG = 'A remarkably long area of interest name'
const LABEL_SETS = {
  short: ['A', 'B', 'C'],
  long: [LONG, 'B', `${LONG} (last)`],
  many: Array.from({ length: 12 }, (_, i) => `Participant ${i + 1}`),
}
const SIZES = [
  [220, 220],
  [400, 900],
  [900, 400],
  [1200, 800],
] as const

describe('matrix layout keeps its labels and titles on the canvas', () => {
  for (const [name, labels] of Object.entries(LABEL_SETS)) {
    for (const [w, h] of SIZES) {
      for (const margin of [0, 20]) {
        it(`${name} labels, ${w}x${h}, margin ${margin}`, () => {
          const L = computeMatrixLayout({
            width: w,
            height: h,
            rowLabels: labels,
            colLabels: labels,
            xAxisTitle: 'To AOI',
            yAxisTitle: 'From AOI',
            cellValueLabels: ['0', '1'],
            layoutConfig: MATRIX_LAYOUT,
            margin,
          })
          // A cell clamped up to the floor overflows by design (the fit guard
          // takes over); every fitted layout must stay inside.
          if (!L.isUltraCompactMode && L.cellSize === MATRIX_LAYOUT.minCellSize) return
          const lastCentre = L.xOffset + L.gridWidth - L.cellSize / 2
          const last = labels[labels.length - 1]
          const reach = L.isCompactMode
            ? width(String(labels.length)) / 2
            : (width(truncatedAxisLabel(last, L.fontSize, MATRIX_LAYOUT.maxLabelLength)) + L.fontSize / 2) *
              Math.SQRT1_2
          expect(lastCentre + reach).toBeLessThanOrEqual(w - margin)
          expect(L.xOffset + L.gridWidth).toBeLessThan(w - margin)

          const lh = axisTitleLineHeight(L.fontSize)
          const yTitleOuter =
            L.xOffset - L.individualLabelMargin - L.yAxisLabelWidth - L.axisTitleGap - L.yTitleLines.length * lh
          const xTitleTop =
            L.yOffset - L.individualLabelMargin - L.xAxisLabelHeight - L.axisTitleGap - L.xTitleLines.length * lh
          expect(yTitleOuter).toBeGreaterThanOrEqual(margin - 1)
          expect(xTitleTop).toBeGreaterThanOrEqual(margin - 1)
        })
      }
    }
  }
})

describe('row label column', () => {
  it('truncates every label into the capped column it reserves', () => {
    const col = rowLabelColumn([LONG, 'P1'], 125)
    expect(col.width).toBeLessThanOrEqual(125)
    for (const label of col.labels) {
      expect(width(label) + ROW_LABEL_GAP).toBeLessThanOrEqual(col.width)
    }
  })

  it('reserves exactly the widest label plus its gap (no padding)', () => {
    const col = rowLabelColumn(['P1', 'P22'], 125)
    expect(col.labels).toEqual(['P1', 'P22'])
    expect(col.width).toBe(Math.ceil(width('P22')) + ROW_LABEL_GAP)
  })
})

describe('gradient legend value labels stay inside the legend span', () => {
  for (const availableWidth of [60, 120, 400]) {
    for (const fixedWidth of [false, true]) {
      it(`width ${availableWidth}, fixed ${fixedWidth}`, () => {
        const g = computeGradientLegendGeometry({
          x: 10,
          y: 0,
          availableWidth,
          availableHeight: 80,
          colorScale: ['#000', '#fff'],
          valueRange: [0.125, 0],
          effectiveMaxValue: 123.456,
          title: 'Fixation duration / ms',
          fixedWidth,
        })
        const { min, max } = g.labels!
        expect(min!.x - width(min!.text) / 2).toBeGreaterThanOrEqual(10)
        expect(max!.x + width(max!.text) / 2).toBeLessThanOrEqual(10 + availableWidth + 0.5)
      })
    }
  }
})

describe('frame resolver vertical edge', () => {
  it('a title-less tick edge reserves the tick gap and the labels, nothing more', () => {
    const labels = ['0', '250', '1000']
    const { rect } = resolveFrameLayout(
      {},
      { left: 0, top: 0, right: 500, bottom: 300 },
      { left: { ticks: { positions: [0, 0.5, 1], labels } } }
    )
    expect(rect.x).toBe(Math.floor(PLOT_TICK_LABEL_GAP + Math.max(...labels.map(l => width(l)))))
  })
})
