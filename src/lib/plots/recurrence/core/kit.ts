/**
 * The recurrence plot kit: one participant's N×N fixation-pair matrix on a
 * square fixation lattice (fixation i counts upward, fixation j rightward).
 * Readable regime: one dot per recurrent pair. Dense regime: a pixel-accurate
 * texture, rasterised once per data/appearance change and memoised per data
 * object, so a resize only re-blits it.
 */
import { convertToHex, hexToRgb } from '$lib/color/conversions'
import {
  alignToPixelCenter,
  cachedRaster,
  strokeCrosshairGuides,
  type PixelLayer,
} from '$lib/plots/shared/canvasUtils'
import { FONT_PRIMARY, GRIDLINE_SECONDARY, PLOT_TICK_LABEL_GAP } from '$lib/plots/shared/const'
import type { CursorRead } from '$lib/plots/shared/cursorMarks'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import { trackOnlyHit } from '$lib/plots/shared/frame'
import { defineKit, memoByRef, type KitChrome, type SceneContext } from '$lib/plots/shared/kit'
import { packRgb } from '$lib/plots/shared/matrixTexture'
import { indexTicks } from '$lib/plots/shared/ticks'
import { RECURRENCE_LAYOUT } from '../const'
import type { RecurrenceData, RecurrenceHighlight, RecurrenceMasking } from '../types'
import { fixationAt, fixationMidpoint } from './collector'
import { latticeOffset, latticeStep, nearestFixation } from './lattice'
import { rasterizeRecurrenceTexture } from './raster'
import { buildRecurrenceTooltipContent } from './tooltip'
import type { RecurrenceInput } from './view'

type Cell = { row: number; col: number }

const L = RECURRENCE_LAYOUT
// Below this fixation spacing individual dots stop resolving; the matrix is
// drawn as a pixel-accurate texture instead (drawTexture) so its pattern still
// reads at thousands of fixations.
const DOT_MODE_MIN = 5
// N runs to thousands: the texture's resolution is capped, and the blit scales it.
const MAX_TEXTURE_PX = 1600

const DOT_RGB = packRgb(hexToRgb(L.dotColor))
const DIAGONAL_RGB = packRgb(hexToRgb(L.diagonalColor))
const DIMMED_RGB = packRgb(hexToRgb(L.dimmedColor))

const FEWER_THAN_TWO: PlotPlaceholderContent = {
  message: 'Fewer than 2 fixations to compare.',
  steps: ['Pick another Participant or Stimulus'],
}

// A masked cell has no datum, but the panel is still this participant: a
// track-only hit with STABLE identity keeps the cursor published and repaints
// nothing. `row: -1` marks it, so the local guide lines skip it.
const MASKED_HIT = trackOnlyHit<Cell>({ row: -1, col: -1 }, 'default')

// The dense texture per data object, rebuilt only on the keys `textureOf`
// passes. The alpha scratch is only touched while painting, so every plot
// shares one.
const rasterOf = memoByRef((_data: RecurrenceData) => cachedRaster())
let texAlpha: Uint8Array | null = null

function highlightColor(highlight: RecurrenceHighlight): string {
  switch (highlight) {
    case 'diagonal':
      return L.highlightDiagonal
    case 'horizontal':
      return L.highlightHorizontal
    case 'vertical':
      return L.highlightVertical
    default:
      return L.dotColor
  }
}

/**
 * Per-column base colour (fixation j's AOI colour, else the default dot
 * colour) packed as RGB, plus whether the column has an AOI colour (highlight
 * keeps AOI colours and only recolours non-AOI cells). Built only while
 * painting the texture, once per rebuild.
 */
function columnColors(data: RecurrenceData) {
  const n = data.fixationCount
  const rgb = new Uint32Array(n)
  const hasAoi = new Uint8Array(n)
  for (let j = 0; j < n; j++) {
    const c = data.fixationAoiColors[j]
    if (c) {
      rgb[j] = packRgb(hexToRgb(convertToHex(c)))
      hasAoi[j] = 1
    } else {
      rgb[j] = DOT_RGB
    }
  }
  return { rgb, hasAoi }
}

/** The cached dense texture; null = unsafe size or canvas-less environment (tests). */
function textureOf(
  data: RecurrenceData,
  res: number,
  highlight: RecurrenceHighlight,
  masking: RecurrenceMasking,
  activeMask: Uint8Array | null
): PixelLayer | null {
  return rasterOf(data)([highlight, masking, activeMask], res, res, layer => {
    if (texAlpha?.length !== res * res) texAlpha = new Uint8Array(res * res)
    const { rgb, hasAoi } = columnColors(data)
    rasterizeRecurrenceTexture(
      {
        n: data.fixationCount,
        res,
        matrix: data.matrix,
        columnRgb: rgb,
        columnHasAoi: hasAoi,
        highlightMask: activeMask,
        accentRgb: packRgb(hexToRgb(highlightColor(highlight))),
        diagonalRgb: DIAGONAL_RGB,
        dimmedRgb: DIMMED_RGB,
        dimmedByte: Math.round(L.dimmedAlpha * 255),
        maskDiagonal: masking === 'diagonal' || masking === 'diagonalLower',
        maskLower: masking === 'diagonalLower',
      },
      layer.pixels,
      texAlpha
    )
  })
}

/**
 * The fixations the cursor's instants land in.
 *
 * Gated on the cursor naming THIS participant, which is what makes the mark
 * honest: absolute time is zeroed per participant, so another person's clock
 * must never be read against this person's fixations. A publisher that carries a
 * time but no participant (an AOI stream, whose series are group-aggregated)
 * therefore marks nothing here, correctly.
 */
function cursorFixations(data: RecurrenceData, participantId: number, cursor: CursorRead): number[] {
  if (!cursor.participants.includes(participantId)) return []
  const found: number[] = []
  for (const t of cursor.times) {
    const i = fixationAt(data, t)
    if (i >= 0) found.push(i)
  }
  return found
}

/**
 * The instants a hovered cell designates: fixation i and fixation j, deduped on
 * the diagonal. A masked cell (row -1) has no datum, so it publishes the
 * participant but no time.
 */
function cellTimes(data: RecurrenceData | null, cell: Cell): number[] {
  if (!data || cell.row < 0) return []
  const both =
    cell.row === cell.col
      ? [fixationMidpoint(data, cell.row)]
      : [fixationMidpoint(data, cell.row), fixationMidpoint(data, cell.col)]
  return both.filter(Number.isFinite).sort((a, b) => a - b)
}

// The square frame as the fixation lattice. Fixation i counts upward (rows
// are bottom-origin), fixation j rightward.
type Lattice = { n: number; x: number; y: number; side: number }
const xOf = (s: Lattice, j: number) => s.x + latticeOffset(s.n, s.side, j)
const yOf = (s: Lattice, i: number) => s.y + s.side - latticeOffset(s.n, s.side, i)

function recurrenceScene(input: RecurrenceInput, { frame }: SceneContext) {
  // The chrome placeholders fewer than 2 fixations, so a scene always has data.
  const data = input.data as RecurrenceData
  const n = data.fixationCount
  const highlight = input.settings.highlight ?? 'none'
  const masking = input.settings.masking ?? 'diagonal'
  const activeMask = highlight !== 'none' ? input.highlightMask : null
  const side = frame.width
  const step = latticeStep(n, side)
  const dense = step < DOT_MODE_MIN

  // Data scans happen here, once per scene, never per dot: the dots scale by
  // the largest duration sum, the dense regime reads its memoised texture.
  let maxDuration = 0
  const durations = data.durationMatrix
  if (!dense && durations) {
    for (let i = 0; i < durations.length; i++) {
      if (durations[i] > maxDuration) maxDuration = durations[i]
    }
  }
  const res = Math.max(1, Math.min(n, MAX_TEXTURE_PX))

  return {
    data,
    n,
    x: frame.x,
    y: frame.y,
    side,
    step,
    dense,
    dotRadius: Math.min(L.maxDotRadius, step * L.dotSpacingRatio),
    masking,
    maskDiagonal: masking === 'diagonal' || masking === 'diagonalLower',
    maskLower: masking === 'diagonalLower',
    activeMask,
    accentColor: highlightColor(highlight),
    maxDuration,
    res,
    texture: dense ? textureOf(data, res, highlight, masking, activeMask) : null,
  }
}

type RecurrenceScene = ReturnType<typeof recurrenceScene>

/** Under the axes: the line of identity, then the lower-triangle mask or the
    dense texture. No cell grid: a fixation is a lattice line, not a cell. */
function drawMatrix(ctx: CanvasRenderingContext2D, s: RecurrenceScene) {
  const { x, y, side } = s
  ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
  ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH
  ctx.beginPath()
  ctx.moveTo(x, y + side)
  ctx.lineTo(x + side, y)
  ctx.stroke()

  if (s.dense) {
    drawTexture(ctx, s)
    return
  }
  if (s.masking === 'diagonalLower') {
    // The diagonal and the visual lower triangle (i < j) as one grey region.
    ctx.fillStyle = L.diagonalColor
    ctx.beginPath()
    ctx.moveTo(x, y + side)
    ctx.lineTo(x + side, y + side)
    ctx.lineTo(x + side, y)
    ctx.closePath()
    ctx.fill()
  }
}

/**
 * The single "1" both axes share: in the left labels' column (right-aligned
 * the tick-label gap left of the axis) and the bottom labels' row.
 */
function drawOriginLabel(ctx: CanvasRenderingContext2D, s: RecurrenceScene) {
  ctx.save()
  ctx.font = `${FONT_PRIMARY.SIZE}px ${FONT_PRIMARY.FAMILY}`
  ctx.fillStyle = FONT_PRIMARY.COLOR
  ctx.textAlign = 'right'
  ctx.textBaseline = 'hanging'
  ctx.fillText('1', s.x - PLOT_TICK_LABEL_GAP, s.y + s.side + PLOT_TICK_LABEL_GAP)
  ctx.restore()
}

/** Readable regime: one dot per recurrent pair, duration-scaled radius. The
    N² loop reads only the locals hoisted here. */
function drawDots(ctx: CanvasRenderingContext2D, s: RecurrenceScene) {
  if (s.dense) return
  const { n, x, y, side, maskDiagonal, maskLower, activeMask, accentColor, maxDuration } = s
  const { matrix, durationMatrix: durations, fixationAoiColors: aoiColors } = s.data
  const hasDuration = durations !== null && maxDuration > 0
  const maxDotRadius = s.dotRadius
  const plainRadius = Math.max(1.5, maxDotRadius * 0.75)
  const dotColorDefault = L.dotColor
  const dimmedColor = L.dimmedColor
  const dimmedAlpha = L.dimmedAlpha

  // Guard against redundant fillStyle string re-assignment (a per-run cost).
  let lastFill = ''
  for (let i = 0; i < n; i++) {
    const rowOffset = i * n
    const cy = y + side - latticeOffset(n, side, i)
    // Masking the lower half keeps only the visual upper triangle (j < i).
    const jEnd = maskLower ? i : n
    for (let j = 0; j < jEnd; j++) {
      if (maskDiagonal && i === j) continue
      if (!matrix[rowOffset + j]) continue

      const cx = x + latticeOffset(n, side, j)

      let dotColor: string = dotColorDefault
      let dotAlpha = 1
      const aoiColor = aoiColors[j]
      if (aoiColor) dotColor = aoiColor

      if (activeMask) {
        if (activeMask[rowOffset + j]) {
          if (!aoiColor) dotColor = accentColor
        } else {
          dotColor = dimmedColor
          dotAlpha = dimmedAlpha
        }
      }

      if (lastFill !== dotColor) {
        ctx.fillStyle = dotColor
        lastFill = dotColor
      }
      if (hasDuration && durations) {
        const ratio = Math.max(0.15, durations[rowOffset + j] / maxDuration)
        ctx.globalAlpha = dotAlpha * (0.3 + 0.7 * ratio)
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(1, maxDotRadius * Math.sqrt(ratio)), 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.globalAlpha = dotAlpha
        ctx.beginPath()
        ctx.arc(cx, cy, plainRadius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
  }
}

/**
 * Dense regime: blit the cached texture widened half a fixation spacing past
 * each edge, so every fixation's texels centre on its lattice line (the data
 * clip trims the overhang). Downscaling smooths into a density texture;
 * upscaling stays crisp.
 */
function drawTexture(ctx: CanvasRenderingContext2D, s: RecurrenceScene) {
  const tex = s.texture
  if (!tex) return
  const { res, step } = s
  const side = s.side + step // N spacings: N-1 inside plus half at each end
  const prevSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = res > side // smooth on downscale only
  ctx.drawImage(tex.canvas as CanvasImageSource, 0, 0, res, res, s.x - step / 2, s.y - step / 2, side, side)
  ctx.imageSmoothingEnabled = prevSmoothing
}

export const recurrenceKit = defineKit<RecurrenceInput, Cell>()({
  label: 'Recurrence Plot visualization',

  // No fit guard: a dense matrix draws as a texture. The placeholders are no
  // data and a matrix that is recurrent everywhere.
  chrome: (input): KitChrome => {
    const n = input.data?.fixationCount ?? 0
    if (n < 2) return { placeholder: FEWER_THAN_TWO }
    // Fixation k sits ON its tick: 1 at the axis line, N on the opposite border.
    // The axes share fixation 1 at the origin, so neither labels it: one "1" sits
    // off the corner instead (drawOriginLabel).
    const xTicks = indexTicks(n, L.tickCount, { labelFirst: false })
    const yTicks = indexTicks(n, L.tickCount, { invert: true, labelFirst: false })
    return {
      // The opposite edges mirror the ticks without labels. '1' reserves room for
      // the origin label drawAboveAxes puts in both gutters.
      axes: {
        bottom: { ticks: xTicks, title: 'Fixation j', reserve: ['1'] },
        left: { ticks: yTicks, title: 'Fixation i', reserve: ['1'] },
        top: { ticks: { positions: xTicks.positions } },
        right: { ticks: { positions: yTicks.positions } },
      },
      gutters: { aspect: 1, pad: { top: L.edgePadPx, right: L.edgePadPx } },
      placeholder: input.warning,
    }
  },

  scene: recurrenceScene,

  draw: (ctx, scene) => drawMatrix(ctx, scene),

  // Edge fixations sit ON the axis lines, so their dots go above the border.
  drawAboveAxes: (ctx, scene) => {
    drawOriginLabel(ctx, scene)
    drawDots(ctx, scene)
  },

  overlay: {
    key: (scene, cursor, input) =>
      cursorFixations(scene.data, input.settings.participantId, cursor).join(','),

    /** Dashed guides along the hovered pair's row i and column j, and along both
        lines of the cursor's fixation (every fixation that recurred with it). */
    draw: (ctx, scene, _frame, { hover, cursor, input }) => {
      const { x, y, side } = scene
      const segments: number[] = []
      const rowLine = (i: number) => {
        const ly = alignToPixelCenter(yOf(scene, i))
        segments.push(x, ly, x + side, ly)
      }
      const colLine = (j: number) => {
        const lx = alignToPixelCenter(xOf(scene, j))
        segments.push(lx, y, lx, y + side)
      }
      for (const k of cursorFixations(scene.data, input.settings.participantId, cursor)) {
        rowLine(k)
        colLine(k)
      }
      // A masked point (row -1) publishes the cursor only, with no local lines.
      if (hover && hover.row >= 0) {
        rowLine(hover.row)
        colLine(hover.col)
      }
      if (segments.length > 0) strokeCrosshairGuides(ctx, segments)
    },
  },

  hit: (scene, mx, my) => {
    // Snap to the nearest fixation pair (the harness hit-tests inside the rect).
    const { n, side } = scene
    const col = nearestFixation(n, side, mx - scene.x, 0)
    const row = nearestFixation(n, side, scene.y + side - my, 0)
    if (col < 0 || row < 0) return null
    if ((scene.maskLower && col >= row) || (scene.maskDiagonal && col === row)) return MASKED_HIT

    return {
      content: buildRecurrenceTooltipContent(scene.data, row, col),
      // Below-right of the dot, the matrix kit's placement.
      anchorX: xOf(scene, col) + scene.dotRadius,
      anchorY: yOf(scene, row) + scene.dotRadius,
      offset: { x: 10, y: 10 },
      tooltipWidth: 140,
      data: { row, col },
    }
  },

  // One publish per fixation pair, not per pointer move.
  hoverKey: cell => `${cell.row},${cell.col}`,

  // This panel IS one participant, so a hover anywhere in it means that person.
  // A CELL additionally means two moments — "they looked here at t1 and again at
  // t2" — which is the datum the time plots can show and this one cannot. Both
  // are live reads, so a data change under a resting pointer re-derives them.
  hover: (cell, act) => {
    act.publish(
      cell && {
        // Reads back empty, never [undefined], if the participant is gone.
        participants: () => {
          const id = act.input().settings.participantId
          return id === undefined ? [] : [id]
        },
        times: () => cellTimes(act.scene()?.data ?? null, cell),
      }
    )
  },
})
