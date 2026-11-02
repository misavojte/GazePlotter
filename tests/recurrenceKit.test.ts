/**
 * The recurrence kit (`recurrence/core/kit.ts`). Pure functions, so no canvas
 * host: build a scene from an input on a square frame, then hit-test, key the
 * overlay and draw it into a recording context.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recurrenceKit } from '$lib/plots/recurrence/core/kit'
import type { RecurrenceInput } from '$lib/plots/recurrence/core/view'
import { fixationMidpoint } from '$lib/plots/recurrence/core'
import { RECURRENCE_LAYOUT } from '$lib/plots/recurrence/const'
import type { RecurrenceData, RecurrencePlotSettings } from '$lib/plots/recurrence/types'
import type { SceneContext } from '$lib/plots/shared/kit'
import type { PlotFrame } from '$lib/plots/shared/frame'
import { NO_CURSOR, type CursorPosition } from '$lib/plots/shared/cursorMarks'
import { recordingContext } from './helpers/canvasRecorder'

const PID = 7

/** n fixations [100k, 100k + 80), every pair recurrent unless a matrix is given. */
function data(n: number, over: Partial<RecurrenceData> = {}): RecurrenceData {
  return {
    matrix: new Uint8Array(n * n).fill(1),
    durationMatrix: null,
    fixationCount: n,
    fixationAoiColors: Array.from({ length: n }, () => null),
    fixationAois: null,
    fixationStarts: Float64Array.from({ length: n }, (_, k) => k * 100),
    fixationEnds: Float64Array.from({ length: n }, (_, k) => k * 100 + 80),
    aoisInEveryFixation: [],
    ...over,
  }
}

function input(
  d: RecurrenceData | null,
  settings: Partial<RecurrencePlotSettings> = {},
  over: Partial<RecurrenceInput> = {}
): RecurrenceInput {
  return {
    data: d,
    settings: { highlight: 'none', masking: 'none', participantId: PID, ...settings } as RecurrencePlotSettings,
    highlightMask: null,
    warning: null,
    ...over,
  }
}

function frameOf(x: number, y: number, side: number): PlotFrame {
  return { x, y, width: side, height: side, right: x + side, bottom: y + side, legendY: y + side, leftTitleOffset: 0, bottomTitleOffset: 0 }
}

function sceneOf(i: RecurrenceInput, side = 400, x = 50, y = 20) {
  const size = { width: side + 100, height: side + 100, margin: 0 }
  const chrome = recurrenceKit.chrome!(i, size)
  const ctx: SceneContext<typeof chrome> = {
    frame: frameOf(x, y, side),
    size,
    chrome,
    pixelRatio: 1,
    gradientLegend: null,
  }
  // Frozen like the host freezes it, so a draw or hit that writes into it throws.
  return { scene: Object.freeze(recurrenceKit.scene(i, ctx)), ctx, input: i }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('recurrence kit', () => {
  it('placeholders fewer than two fixations and passes the warning through', () => {
    const size = { width: 300, height: 300, margin: 0 }
    expect(recurrenceKit.chrome!(input(null), size).placeholder).toMatchObject({
      message: 'Fewer than 2 fixations to compare.',
    })
    expect(recurrenceKit.chrome!(input(data(1)), size).placeholder).toMatchObject({
      message: 'Fewer than 2 fixations to compare.',
    })
    const warning = { message: 'AOI in every fixation' }
    expect(recurrenceKit.chrome!(input(data(4), {}, { warning }), size).placeholder).toBe(warning)
    const chrome = recurrenceKit.chrome!(input(data(4)), size)
    expect(chrome.placeholder).toBeNull()
    expect(chrome.gutters?.aspect).toBe(1)
    expect(chrome.axes?.bottom?.title).toBe('Fixation j')
    expect(chrome.axes?.left?.title).toBe('Fixation i')
    // The shared origin is labelled once, off the corner, not by either axis.
    expect(chrome.axes?.bottom?.ticks?.labels?.[0]).toBe('')
    expect(chrome.axes?.bottom?.reserve).toEqual(['1'])
  })

  it('switches from dots to the texture below five pixels per fixation', () => {
    const dots = sceneOf(input(data(5))).scene
    expect(dots.dense).toBe(false)
    expect(dots.step).toBe(100)
    expect(dots.dotRadius).toBe(RECURRENCE_LAYOUT.maxDotRadius)
    const dense = sceneOf(input(data(200))).scene
    expect(dense.dense).toBe(true)
    // No canvas in node: the texture is skipped, not thrown on.
    expect(dense.texture).toBeNull()
  })

  it('scans the duration maximum once, in the scene, for the dots only', () => {
    const durationMatrix = Float32Array.from({ length: 25 }, (_, k) => k * 10)
    expect(sceneOf(input(data(5, { durationMatrix }))).scene.maxDuration).toBe(240)
    expect(sceneOf(input(data(5))).scene.maxDuration).toBe(0)
    const dense = data(200, { durationMatrix: new Float32Array(200 * 200).fill(5) })
    expect(sceneOf(input(dense)).scene.maxDuration).toBe(0)
  })

  it('applies the highlight mask only while a highlight is chosen', () => {
    const highlightMask = new Uint8Array(25)
    expect(sceneOf(input(data(5), {}, { highlightMask })).scene.activeMask).toBeNull()
    const lit = sceneOf(input(data(5), { highlight: 'diagonal' }, { highlightMask })).scene
    expect(lit.activeMask).toBe(highlightMask)
    expect(lit.accentColor).toBe(RECURRENCE_LAYOUT.highlightDiagonal)
  })

  it('memoises the dense texture per data object across resizes', () => {
    let puts = 0
    class FakeOffscreenCanvas {
      constructor(
        public width: number,
        public height: number
      ) {}
      getContext() {
        return {
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          putImageData: () => {
            puts++
          },
        }
      }
    }
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)

    const d = data(300)
    const a = sceneOf(input(d), 400).scene
    const b = sceneOf(input(d), 600).scene
    expect(a.texture).not.toBeNull()
    expect(b.texture).toBe(a.texture)
    expect(puts).toBe(1)
    expect(a.res).toBe(300)
    // Every recurrent cell painted: the texture is opaque everywhere.
    expect(a.texture!.pixels.every(p => p >>> 24 === 255)).toBe(true)

    // A new derive (a new data object) rasterises its own.
    const c = sceneOf(input(data(300)), 400).scene
    expect(c.texture).not.toBe(a.texture)
    expect(puts).toBe(2)

    // The blit widens the texture half a spacing past each edge.
    const rec = recordingContext()
    recurrenceKit.draw(rec.ctx, a, frameOf(50, 20, 400))
    const blit = rec.calls.find(c => c.method === 'drawImage')!.args
    const step = 400 / 299
    expect(blit.slice(1, 5)).toEqual([0, 0, 300, 300])
    expect(blit[5]).toBeCloseTo(50 - step / 2)
    expect(blit[7]).toBeCloseTo(400 + step)
  }, 20_000)

  it('hit-tests the nearest fixation pair into its tooltip and payload', () => {
    const { scene, ctx, input: i } = sceneOf(input(data(5)))
    // Fixation j = 2 (col 1) right of the origin, fixation i = 4 (row 3) up.
    const hit = recurrenceKit.hit!(scene, 50 + 104, 20 + 400 - 297, ctx.frame, i)
    expect(hit?.data).toEqual({ row: 3, col: 1 })
    expect(hit?.content[0]).toEqual({ key: 'Fixations', value: 'i 4, j 2' })
    expect(hit?.anchorX).toBe(50 + 100 + scene.dotRadius)
    expect(hit?.anchorY).toBe(20 + 400 - 300 + scene.dotRadius)
    // Past the axis line: nothing.
    expect(recurrenceKit.hit!(scene, 49, 200, ctx.frame, i)).toBeNull()
  })

  it('returns one stable track-only hit on a masked cell', () => {
    const diag = sceneOf(input(data(5), { masking: 'diagonal' }))
    const at = (s: typeof diag, col: number, row: number) =>
      recurrenceKit.hit!(s.scene, 50 + col * 100, 20 + 400 - row * 100, s.ctx.frame, s.input)
    const masked = at(diag, 2, 2)
    expect(masked?.content).toEqual([])
    expect(masked?.data).toEqual({ row: -1, col: -1 })
    expect(at(diag, 3, 3)).toBe(masked)
    expect(at(diag, 1, 3)?.data).toEqual({ row: 3, col: 1 })
    const upper = sceneOf(input(data(5), { masking: 'diagonalLower' }))
    expect(at(upper, 3, 1)).toBe(masked)
    expect(at(upper, 1, 3)?.data).toEqual({ row: 3, col: 1 })
  })

  it('keys the overlay on the fixations the cursor lands in, for this participant only', () => {
    const { scene, input: i } = sceneOf(input(data(5)))
    const key = (times: number[], participants: number[]) =>
      recurrenceKit.overlay!.key!(scene, { times, participants }, i)
    expect(key([150], [PID])).toBe('1')
    expect(key([10, 250], [PID, 99])).toBe('0,2')
    // A saccade (between fixations) marks nothing; neither does another person.
    expect(key([90], [PID])).toBe('')
    expect(key([150], [99])).toBe('')
    expect(key([150], [])).toBe('')
    expect(recurrenceKit.overlay!.key!(scene, NO_CURSOR, i)).toBe('')
  })

  it('draws one dot per recurrent pair the masking keeps, plus the origin label', () => {
    const count = (masking: RecurrencePlotSettings['masking']) => {
      const { scene, ctx } = sceneOf(input(data(5), { masking }))
      const rec = recordingContext()
      recurrenceKit.draw(rec.ctx, scene, ctx.frame)
      recurrenceKit.drawAboveAxes!(rec.ctx, scene, ctx.frame)
      expect(rec.count('fillText')).toBe(1)
      return rec.count('arc')
    }
    expect(count('none')).toBe(25)
    expect(count('diagonal')).toBe(20)
    expect(count('diagonalLower')).toBe(10)
  })

  it('scales dot radius by duration when the duration matrix is present', () => {
    const durationMatrix = new Float32Array(4).fill(100)
    durationMatrix[1] = 400
    const { scene, ctx } = sceneOf(input(data(2, { durationMatrix })))
    const rec = recordingContext()
    recurrenceKit.drawAboveAxes!(rec.ctx, scene, ctx.frame)
    const radii = rec.calls.filter(c => c.method === 'arc').map(c => c.args[2] as number)
    expect(radii).toHaveLength(4)
    expect(radii[1]).toBe(scene.dotRadius)
    expect(radii[0]).toBeCloseTo(scene.dotRadius * Math.sqrt(0.25))
  })

  it('draws a dense matrix without a canvas and without dots', () => {
    const { scene, ctx } = sceneOf(input(data(400)))
    const rec = recordingContext()
    recurrenceKit.draw(rec.ctx, scene, ctx.frame)
    recurrenceKit.drawAboveAxes!(rec.ctx, scene, ctx.frame)
    expect(rec.count('arc')).toBe(0)
    expect(rec.count('drawImage')).toBe(0)
  })

  it('strokes dashed guides for the hovered pair and the cursor fixation', () => {
    const { scene, ctx, input: i } = sceneOf(input(data(5)))
    const guides = (hover: { row: number; col: number } | null, times: number[]) => {
      const rec = recordingContext()
      recurrenceKit.overlay!.draw(rec.ctx, scene, ctx.frame, {
        hover,
        cursor: { times, participants: [PID] },
        input: i,
      })
      return rec.count('moveTo')
    }
    expect(guides({ row: 3, col: 1 }, [])).toBe(2)
    expect(guides({ row: 3, col: 1 }, [150])).toBe(4)
    expect(guides({ row: -1, col: -1 }, [])).toBe(0)
    expect(guides(null, [])).toBe(0)
  })

  it('publishes the participant and both moments of a hovered pair, live', () => {
    const d = data(5)
    const i = input(d)
    const { scene, ctx } = sceneOf(i)
    const published: (CursorPosition | null)[] = []
    let current = i
    const act = {
      scene: () => scene,
      input: () => current,
      frame: () => ctx.frame,
      publish: (at: CursorPosition | null) => published.push(at),
    } as unknown as Parameters<NonNullable<typeof recurrenceKit.hover>>[1]
    type Record = { participants: () => number[]; times: () => number[] }

    recurrenceKit.hover!({ row: 3, col: 1 }, act)
    const pair = published.at(-1) as Record
    expect(pair.participants()).toEqual([PID])
    expect(pair.times()).toEqual([fixationMidpoint(d, 1), fixationMidpoint(d, 3)])

    recurrenceKit.hover!({ row: 2, col: 2 }, act)
    expect((published.at(-1) as Record).times()).toEqual([fixationMidpoint(d, 2)])

    recurrenceKit.hover!({ row: -1, col: -1 }, act)
    const masked = published.at(-1) as Record
    expect(masked.participants()).toEqual([PID])
    expect(masked.times()).toEqual([])

    // The participant is read when the record is read, not when it was published.
    current = { ...current, settings: { ...current.settings, participantId: 9 } }
    expect(pair.participants()).toEqual([9])

    recurrenceKit.hover!(null, act)
    expect(published.at(-1)).toBeNull()

    expect(recurrenceKit.hoverKey!({ row: 3, col: 1 })).toBe(recurrenceKit.hoverKey!({ row: 3, col: 1 }))
    expect(recurrenceKit.hoverKey!({ row: 3, col: 1 })).not.toBe(recurrenceKit.hoverKey!({ row: 1, col: 3 }))
  })
})
