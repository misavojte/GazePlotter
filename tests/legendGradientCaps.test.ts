import { describe, it, expect } from 'vitest'
import {
  computeGradientLegendGeometry,
  drawGradientLegend,
  type GradientLegendConfig,
} from '../src/lib/plots/shared/legendGradient'

const CAP = 15

// availableHeight below the minimalist threshold: bar only, no title wrapping.
const MINIMAL: GradientLegendConfig = {
  x: 0,
  y: 0,
  availableWidth: 400,
  availableHeight: 20,
  colorScale: ['#000000', '#ffffff'],
  valueRange: [0, 5],
  effectiveMaxValue: 5,
  title: 'Value',
}

describe('gradient legend out-of-bounds caps', () => {
  it('draws no caps without cap colors', () => {
    const g = computeGradientLegendGeometry(MINIMAL)
    expect(g.belowMinRect).toBeUndefined()
    expect(g.aboveMaxRect).toBeUndefined()
    expect(g.width).toBe(g.gradientRect.width)
  })

  it('puts the below-min cap left of the bar', () => {
    const g = computeGradientLegendGeometry({ ...MINIMAL, belowMinColor: '#111111' })
    expect(g.belowMinRect).toMatchObject({ x: g.x, width: CAP })
    expect(g.gradientRect.x).toBe(g.x + CAP)
    expect(g.width).toBe(g.gradientRect.width + CAP)
  })

  it('puts the above-max cap right of the bar under an explicit max', () => {
    const g = computeGradientLegendGeometry({
      ...MINIMAL,
      belowMinColor: '#111111',
      aboveMaxColor: '#eeeeee',
    })
    expect(g.aboveMaxRect).toMatchObject({
      x: g.gradientRect.x + g.gradientRect.width,
      width: CAP,
    })
    expect(g.width).toBe(g.gradientRect.width + 2 * CAP)
  })

  it('hides the above-max cap while the max is auto (0)', () => {
    const g = computeGradientLegendGeometry({
      ...MINIMAL,
      valueRange: [0, 0],
      belowMinColor: '#111111',
      aboveMaxColor: '#eeeeee',
    })
    expect(g.belowMinRect).toBeDefined()
    expect(g.aboveMaxRect).toBeUndefined()
  })

  it('keeps bar plus caps inside a narrow fixed-width span', () => {
    const g = computeGradientLegendGeometry({
      ...MINIMAL,
      availableWidth: 200,
      fixedWidth: true,
      belowMinColor: '#111111',
      aboveMaxColor: '#eeeeee',
    })
    expect(g.width).toBeLessThanOrEqual(200)
    expect(g.gradientRect.width).toBe(200 - 2 * CAP)
  })

  it('in full mode the caps share the bar row and the labels sit at the bar ends', () => {
    const g = computeGradientLegendGeometry({
      ...MINIMAL,
      availableHeight: 80,
      valueRange: [2, 7],
      effectiveMaxValue: 7,
      belowMinColor: '#111111',
      aboveMaxColor: '#eeeeee',
    })
    expect(g.isMinimalist).toBe(false)
    for (const cap of [g.belowMinRect, g.aboveMaxRect]) {
      expect(cap).toMatchObject({ y: g.gradientRect.y, height: g.gradientRect.height })
    }
    expect(g.labels?.min).toMatchObject({ text: '2', x: g.gradientRect.x })
    expect(g.labels?.max).toMatchObject({
      text: '7',
      x: g.gradientRect.x + g.gradientRect.width,
    })
  })
})

/** Color stops the legend bar's gradient receives. */
function barStops(colorScale: string[]): [number, string][] {
  const stops: [number, string][] = []
  const noop = () => {}
  const ctx = {
    createLinearGradient: () => ({ addColorStop: (o: number, c: string) => stops.push([o, c]) }),
    fillRect: noop, strokeRect: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    stroke: noop, fillText: noop, save: noop, restore: noop,
  } as unknown as CanvasRenderingContext2D
  drawGradientLegend(ctx, computeGradientLegendGeometry({ ...MINIMAL, colorScale }))
  return stops
}

describe('gradient legend bar stops', () => {
  it('keeps the 2- and 3-stop palettes as they were', () => {
    expect(barStops(['#000000', '#ffffff'])).toEqual([[0, '#000000'], [1, '#ffffff']])
    expect(barStops(['#000000', '#888888', '#ffffff'])).toEqual([
      [0, '#000000'],
      [0.5, '#888888'],
      [1, '#ffffff'],
    ])
  })

  it('spaces a sampled ramp of any length evenly', () => {
    const ramp = ['#000000', '#333333', '#666666', '#999999', '#cccccc']
    expect(barStops(ramp).map(s => s[0])).toEqual([0, 0.25, 0.5, 0.75, 1])
  })
})
