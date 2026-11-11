/**
 * The matrix kit (`shared/matrixKit.ts`): the one kit behind the transition
 * matrix, metric matrix, correlation heatmap, SPLOM and similarity matrix. Pure
 * functions, so no canvas host: build a scene from an input, then hit-test and
 * draw it into a recording context.
 */
import { describe, expect, it } from 'vitest'
import { matrixKit, type MatrixInput } from '$lib/plots/shared/matrixKit'
import type { SceneContext } from '$lib/plots/shared/kit'
import { NO_CURSOR } from '$lib/plots/shared/cursorMarks'
import { recordingContext } from './helpers/canvasRecorder'
import { renderPlot } from '$lib/plots/shared/plotRender'

const SCALE = ['#ffffff', '#000000']

function input(over: Partial<MatrixInput> = {}): MatrixInput {
  return {
    matrix: new Float64Array([0, 1, 2.341, 3]),
    labels: ['A', 'B'],
    xAxisTitle: 'To',
    yAxisTitle: 'From',
    colorScale: SCALE,
    legendTitle: 'Transitions / count',
    getCellTooltip: (row, col) => [{ key: 'Cell', value: `${row},${col}` }],
    ...over,
  }
}

function sceneOf(i: MatrixInput, width = 500, height = 500) {
  const size = { width, height, margin: 0 }
  const chrome = matrixKit.chrome!(i, size)
  const ctx: SceneContext<typeof chrome> = {
    frame: { x: 0, y: 0, width, height, right: width, bottom: height, legendY: height, leftTitleOffset: 0, bottomTitleOffset: 0 },
    size,
    chrome,
    pixelRatio: 1,
    gradientLegend: null,
  }
  return { scene: matrixKit.scene(i, ctx), ctx }
}

describe('matrix kit', () => {
  it('passes the data placeholder through the chrome', () => {
    const placeholder = { message: 'No AOIs' }
    expect(matrixKit.chrome!(input({ placeholder }), { width: 1, height: 1, margin: 0 }).placeholder).toBe(placeholder)
  })

  it('takes the auto colour max from the data, ceiled to the decimals', () => {
    const { scene } = sceneOf(input())
    // 3 is the data max: it maps to the scale top.
    expect(scene.render.getCellColor(3)).toBe(scene.render.getCellColor(1e9))
  })

  it('paints out-of-range cells only where a range end is set', () => {
    const auto = sceneOf(input({ belowMinColor: '#111', aboveMaxColor: '#222' })).scene
    // Auto max: nothing is above it, so no above-max fill.
    expect(auto.render.getCellColor(3)).not.toBe('#222')
    const ranged = sceneOf(
      input({ colorValueRange: [1, 2], belowMinColor: '#111', aboveMaxColor: '#222', showAboveMaxLabels: false })
    ).scene
    expect(ranged.render.getCellColor(0)).toBe('#111')
    expect(ranged.render.getCellColor(3)).toBe('#222')
    expect(ranged.render.showCellValue!(3)).toBe(false)
    expect(ranged.render.showCellValue!(1.5)).toBe(true)
  })

  it('fills a non-finite cell with its own colour and prints no value', () => {
    const { scene } = sceneOf(input({ nonFiniteColor: '#abcdef' }))
    expect(scene.render.getCellColor(Number.NaN)).toBe('#abcdef')
    expect(scene.render.showCellValue!(Number.NaN)).toBe(false)
    expect(scene.render.formatCellValue(Number.NaN)).toBe('—')
  })

  it('guards a cell too small to read', () => {
    const big = sceneOf(input())
    expect(matrixKit.fit!(big.scene, big.ctx)).toBeNull()
    const many = 120
    const tiny = sceneOf(
      input({
        matrix: new Float64Array(many * many),
        labels: Array.from({ length: many }, (_, i) => `AOI ${i}`),
        fitSteps: ['Merge some AOIs'],
      }),
      300,
      300
    )
    expect(matrixKit.fit!(tiny.scene, tiny.ctx)).toMatchObject({ steps: expect.arrayContaining(['Merge some AOIs']) })
  })

  it('hit-tests a cell into its tooltip and payload', () => {
    const { scene, ctx } = sceneOf(input())
    const { xOffset, yOffset, cellSize } = scene.layout
    const hit = matrixKit.hit!(scene, xOffset + cellSize * 1.5, yOffset + cellSize * 0.5, ctx.frame, scene.input)
    expect(hit?.data).toEqual({ row: 0, col: 1 })
    expect(hit?.content).toEqual([{ key: 'Cell', value: '0,1' }])
  })

  it('keys the overlay on the cursor rows and columns, not on the cursor arrays', () => {
    const { scene } = sceneOf(input({ rowParticipantIds: [10, 20], colParticipantIds: [10, 20] }))
    const key = (participants: number[]) => matrixKit.overlay!.key!(scene, { times: [], participants }, scene.input)
    expect(key([20])).toBe(key([20, 99]))
    expect(key([20])).not.toBe(key([10]))
    expect(matrixKit.overlay!.key!(scene, NO_CURSOR, scene.input)).toBe('||')
  })

  it('draws a 130-AOI matrix, one fill per cell', () => {
    const n = 130
    const values = new Float64Array(n * n).map((_, i) => i % 97)
    const { scene, ctx } = sceneOf(
      input({ matrix: values, labels: Array.from({ length: n }, (_, i) => `${i}`) }),
      2000,
      2000
    )
    expect(matrixKit.fit!(scene, ctx)).toBeNull()
    const rec = recordingContext()
    matrixKit.draw(rec.ctx, scene, ctx.frame)
    expect(rec.count('fillRect')).toBeGreaterThanOrEqual(n * n)
  })

  it('renders the whole plot headless, with no Svelte', () => {
    const rec = recordingContext()
    const build = renderPlot(rec.ctx, matrixKit, input(), { width: 500, height: 500, margin: 0 })
    expect(build.placeholder).toBeNull()
    expect(rec.count('fillRect')).toBeGreaterThanOrEqual(4)
    const card = recordingContext()
    expect(renderPlot(card.ctx, matrixKit, input({ placeholder: 'No AOIs' }), { width: 500, height: 500, margin: 0 }).scene).toBeNull()
  })

  it('fades cells off the highlighted AOIs and toggles from an axis label', () => {
    const { scene } = sceneOf(input({ labelIds: ['1', '-1'], highlights: ['1', '9'] }))
    // Row or column A (id 1) keeps its colour; only B to B fades.
    expect(scene.render.dimCell!(0, 1)).toBe(false)
    expect(scene.render.dimCell!(1, 0)).toBe(false)
    expect(scene.render.dimCell!(1, 1)).toBe(true)
    // A highlight this matrix does not draw fades nothing.
    expect(sceneOf(input({ labelIds: ['1', '-1'], highlights: ['9'] })).scene.render.dimCell).toBeUndefined()

    const { layout } = scene
    const rowLabel = matrixKit.hit!(scene, layout.xOffset - layout.individualLabelMargin - 2, layout.yOffset + layout.cellSize * 1.5, scene as never, scene.input)
    expect(rowLabel?.data).toEqual({ label: 1 })
    expect(rowLabel?.content).toEqual([{ key: '', value: 'Highlight B' }])
    const toggled: unknown[] = []
    matrixKit.click!({ label: 1 }, { input: () => scene.input, toggle: (k: string, v: string) => toggled.push(k, v) } as never)
    expect(toggled).toEqual(['highlights', '-1'])
    // A rotated column label: up and to the right of its column's foot.
    const foot = layout.yOffset - layout.individualLabelMargin
    const colLabel = matrixKit.hit!(scene, layout.xOffset + layout.cellSize * 0.5 + 6, foot - 6, scene as never, scene.input)
    expect(colLabel?.data).toEqual({ label: 0 })
    // Without ids the labels stay inert.
    const plain = sceneOf(input()).scene
    expect(matrixKit.hit!(plain, layout.xOffset - layout.individualLabelMargin - 2, layout.yOffset + layout.cellSize * 1.5, plain as never, plain.input)).toBeNull()
  })
})
