/**
 * The Scarf Plot kit: one row per participant, the gaze sequence composited
 * straight from the binary segment store (`renderer.ts`), the event band hanging
 * below each row in combined mode, and the grouped interactive legend below the
 * x-axis. Up to millions of segments, so the draw allocates nothing it can build
 * once: style arrays, identifier maps and the label column are memoised by the
 * data's identity, the highlight mask and the render context live in the scene.
 */
import { drawParticipantRowAxis } from '$lib/plots/shared/axisUtils'
import {
  alignToPixelCenter,
  markCrosshairStrips,
  rowStrips,
  strokeCrosshairGuides,
} from '$lib/plots/shared/canvasUtils'
import { PLOT_LEGEND_GAP } from '$lib/plots/shared/const'
import { timeCursor, type TimeAxis } from '$lib/plots/shared/cursorMarks'
import { cannotFitPlaceholder } from '$lib/plots/shared/drawCanvasPlaceholder'
import {
  resolveFrameLayout,
  trackOnlyHit,
  type FrameAxes,
  type PlotFrame,
} from '$lib/plots/shared/frame'
import { defineKit, memoByRef } from '$lib/plots/shared/kit'
import {
  computeGroupedLegendGeometry,
  drawLegend,
  drawLegendGroupTitles,
  hitTestLegend,
  LEGEND_CONFIG,
  type LegendGeometry,
  type LegendGroup,
  type LegendItemGeometry,
} from '$lib/plots/shared/legendRendering'
import { niceTimelineTicks } from '$lib/plots/shared/plotArea'
import { OVERLAY_EVENT_STRIDE, SCARF_LAYOUT } from '../const'
import { findGazeSegmentAt } from './hitTest'
import {
  calculateIsCompactMode,
  calculateLegendStructuralHeight,
  calculateOverlayLayout,
  calculateOverlayMinRowPitch,
  calculatePlotLayout,
  getScarfIdentifierSystem,
  getXAxisLabel,
  scarfFrameGutters,
  scarfLabelColumn,
} from './layout'
import {
  drawScarfBands,
  drawScarfGrid,
  drawScarfHighlightMarkers,
  type ScarfHighlightMarkerOptions,
  type ScarfLayoutContext,
} from './renderer'
import { buildScarfEventTooltipContent } from './tooltip'
import {
  calculateHighlightMask,
  createStyleArrays,
  mapDataToLegendGroups,
  scarfRange,
} from './transformer'
import type { ScarfInput } from './view'
import type {
  ScarfData,
  ScarfEventStyle,
  ScarfPlotSettings,
  ScarfRectStyle,
  ScarfStyleItem,
} from '../types'

/** Harness hover payload: crosshair row + mouse x (canvas px). */
type ScarfHover = { row: number; x: number }

/** Legend block reserved at the bottom, gap folded in (the resolver abuts the
 *  block straight to the x-axis gutter). */
const LEGEND_GAP = PLOT_LEGEND_GAP + SCARF_LAYOUT.LEGEND_GAP_DELTA

// ── What the data alone decides, memoised by its identity ──
// A resize, a highlight toggle or a cursor move rebuilds the scene; none of them
// rebuilds these. A drag-pan replaces the data, so they follow it.

type LabelColumn = ReturnType<typeof scarfLabelColumn>

interface ScarfDataStyles {
  identifierSystem: ReturnType<typeof getScarfIdentifierSystem>
  rectStyleArray: ScarfRectStyle[]
  eventStyleArray: ScarfEventStyle[]
  legendGroups: LegendGroup[]
  /** Row order for the PLOT CURSOR. */
  participantIds: number[]
  /** Names pre-truncated to the column the gutter reserves (single source), per compact mode. */
  labelColumns: { compact?: LabelColumn; full?: LabelColumn }
}

function styleMap<S extends object>(items: ScarfStyleItem[], base: (color: string) => S) {
  const map = new Map<string, { normal: S; dimmed: S & { opacity: number } }>()
  for (const { identifier, color } of items) {
    const normal = base(color)
    map.set(identifier, { normal, dimmed: { ...normal, opacity: 0.15 } })
  }
  return map
}

const stylesOf = memoByRef((data: ScarfData): ScarfDataStyles => {
  const styling = data.stylingAndLegend
  const identifierSystem = getScarfIdentifierSystem(styling)
  const { rectStyles, eventStyles } = createStyleArrays(
    identifierSystem,
    styleMap(styling ? [...styling.aoi, ...styling.category] : [], color => ({ fill: color })),
    styleMap(styling?.event ?? [], color => ({ fill: color, stroke: color, strokeWidth: 1 })),
    // One rect style per identifier: the gaze render resolves styleIdx inline.
    identifierSystem.indexToId.size,
    data.visualEventBuckets.length
  )
  return {
    identifierSystem,
    rectStyleArray: rectStyles,
    eventStyleArray: eventStyles,
    legendGroups: mapDataToLegendGroups(data.legendData?.groups ?? []),
    participantIds: data.participants.map(p => p.id),
    labelColumns: {},
  }
})

function labelColumnOf(data: ScarfData, compact: boolean): LabelColumn {
  const columns = stylesOf(data).labelColumns
  const key = compact ? 'compact' : 'full'
  return (columns[key] ??= scarfLabelColumn(compact, data.participants.map(p => p.label)))
}

function rowLayout(data: ScarfData, rowBandHeight: number) {
  const count = data.participants.length
  if (data.isOverlay) {
    return calculateOverlayLayout(count, data.eventZoneConcurrency ?? 0, rowBandHeight)
  }
  const compact = calculateIsCompactMode(count, rowBandHeight)
  const base = calculatePlotLayout(count, rowBandHeight, compact)
  return {
    ...base,
    eventLaneHeight: 0,
    eventZoneHeight: 0,
    eventBandTop: 0,
  }
}

/** The rows' band in canvas px (see `rowBand` in the scene). */
interface RowBand {
  x: number
  y: number
  width: number
  height: number
}

// The rows, not the frame's band: the fractional row stack is the truth (the
// frame is its whole-pixel cap), and the pointer handlers aren't gated at all.
function inRows(band: RowBand, mx: number, my: number): boolean {
  return mx >= band.x && mx <= band.x + band.width && my >= band.y && my <= band.y + band.height
}

export const scarfKit = defineKit<ScarfInput, ScarfHover, ScarfPlotSettings>()({
  label: 'Scarf plot visualization',
  clip: false,

  chrome: (input, size) => {
    const { data, settings } = input
    const xAxisLabel = getXAxisLabel(
      settings.timeline,
      settings.timelineStart,
      settings.timelineEnd,
      settings.ordinalStart,
      settings.ordinalEnd
    )
    const legendWidth = Math.max(0, size.width - 2 * size.margin)
    const legendHeight = calculateLegendStructuralHeight(data.legendData?.groups ?? [], legendWidth)
    const legendSpace = legendHeight > 0 ? LEGEND_GAP + legendHeight : 0

    const axes: FrameAxes = {
      bottom: { title: xAxisLabel, ticks: niceTimelineTicks(data.timeline) },
    }

    // ── The row band: the ONE height the scarf's layout reads ──
    // It cannot be the frame's height, because compact mode decides the left
    // label gutter and would close a loop: pad.left ← isCompact ← row band ←
    // bottom gutter ← the plot width the resolver wraps the axis title to ←
    // pad.left. So the band asks the SAME resolver over the same declaration,
    // with the left inset pinned at its cap: independent of compact mode, and the
    // narrowest plot the scarf can have, so the title wraps to its tallest and the
    // band is never taller than the frame the scarf ends up drawing in.
    // LOAD-BEARING: the probe is always uncapped (the full band the rows may grow
    // into); passing the row-stack cap would cycle, as it derives from the layout
    // this band feeds.
    const { rect } = resolveFrameLayout(
      scarfFrameGutters({ leftLabelWidth: SCARF_LAYOUT.LEFT_LABEL_MAX_WIDTH, legendSpace }),
      {
        left: 0,
        top: 0,
        right: Math.max(1, size.width - size.margin * 2),
        bottom: Math.max(1, size.height - size.margin * 2),
      },
      axes
    )
    const rowBandHeight = Math.max(1, rect.height)
    const layout = rowLayout(data, rowBandHeight)
    const labelColumn = labelColumnOf(data, layout.isCompact)
    const participantBarsHeight = data.participants.length * layout.heightOfBarWrap

    return {
      axes,
      // Same declaration the row band probes, with the real label column: so
      // `frame.x`/`frame.width` ARE the scarf's plot columns, and the resolver
      // owns the x-axis gutter and the legend block. The row stack caps the frame
      // height: when the rows stop growing (MAX_BAR_SCALE) the resolver cuts the
      // frame to them and centres it, so the border and x-axis hug the rows
      // instead of stretching over empty band.
      gutters: scarfFrameGutters({
        leftLabelWidth: labelColumn.width,
        legendSpace,
        // Ceiled so the border never lands inside the last fractional row.
        maxHeight: data.participants.length > 0 ? Math.ceil(participantBarsHeight) : undefined,
      }),
      rowBandHeight,
      layout,
      labelColumn,
      participantBarsHeight,
      legendWidth,
    }
  },

  scene: (input, { frame, size, chrome, pixelRatio }) => {
    const { data } = input
    const highlights = input.highlights ?? []
    const styles = stylesOf(data)
    const { layout, participantBarsHeight } = chrome

    // ── Vertical placement ──
    // The frame is already capped to the row stack and centred by the resolver
    // (see `chrome.gutters`), so the rows simply start at its top edge.
    const plotTop = frame.y
    const legendTop = frame.legendY + LEGEND_GAP

    const legendGeometry: LegendGeometry =
      styles.legendGroups.length === 0
        ? { items: [], groupTitles: [], totalHeight: 0, itemsPerRow: 3 }
        : computeGroupedLegendGeometry(
            styles.legendGroups,
            LEGEND_CONFIG,
            size.margin,
            legendTop,
            chrome.legendWidth
          )

    // The rows, not the frame: the frame is the stack's whole-pixel cap (and,
    // under the min-scale floor, can be shorter), so the fractional row stack
    // stays the truth. One source for the blocked region, the time guide and the
    // PLOT CURSOR mark, so a guide can never hang below the last row.
    const rowBand: RowBand = {
      x: frame.x,
      y: plotTop,
      width: frame.width,
      height: participantBarsHeight,
    }
    const timeAxis: TimeAxis = {
      band: rowBand,
      timeline: data.timeline,
      rowIds: styles.participantIds,
    }

    const render: ScarfLayoutContext = {
      heightOfBar: layout.heightOfBar,
      spaceAboveRect: layout.spaceAboveRect,
      nonFixationHeight: layout.nonFixationHeight,
      heightOfBarWrap: layout.heightOfBarWrap,
      scaleFactor: layout.scaleFactor,
      isCompact: layout.isCompact,
      plotLeft: frame.x,
      plotWidth: frame.width,
      plotTop,
      participantBarsHeight,
      eventLaneHeight: layout.eventLaneHeight,
      eventZoneHeight: layout.eventZoneHeight,
      eventBandTop: layout.eventBandTop,
      isOverlay: data.isOverlay,
      deviceScale: pixelRatio,
    }

    const highlightMask = calculateHighlightMask(highlights, styles.identifierSystem)
    const markers: ScarfHighlightMarkerOptions = {
      rectStyleArray: styles.rectStyleArray,
      highlightMask,
    }

    return {
      data,
      highlights,
      layout,
      labelColumn: chrome.labelColumn,
      rowBandHeight: chrome.rowBandHeight,
      rowBand,
      timeAxis,
      render,
      legendGeometry,
      highlightMask,
      markers,
      identifierSystem: styles.identifierSystem,
      rectStyleArray: styles.rectStyleArray,
      eventStyleArray: styles.eventStyleArray,
      /** The total canvas width the drag step scales by. */
      canvasWidth: size.width,
    }
  },

  // The verdict is about the row band (see `chrome`), which the scarf measures
  // itself to keep the left gutter out of a cycle. It is still a fit guard, not a
  // data placeholder: it turns on and off with the canvas size.
  fit: ({ data, layout, rowBandHeight }) => {
    const count = data.participants.length
    let canRender: boolean
    if (data.isOverlay) {
      const minPitch = calculateOverlayMinRowPitch(data.eventZoneConcurrency ?? 0)
      canRender = rowBandHeight >= Math.max(count * minPitch, SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT)
    } else {
      const minPlotHeight = layout.isCompact
        ? Math.max(count * SCARF_LAYOUT.MIN_BAR_HEIGHT, SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT)
        : SCARF_LAYOUT.MIN_PLOT_HEIGHT_COMPACT
      canRender = rowBandHeight >= minPlotHeight
    }
    if (canRender) return null

    const hasEvents =
      data.isOverlay ||
      (data.visualEventBuckets && data.visualEventBuckets.some(b => b.length > 0)) ||
      (data.eventZoneConcurrency ?? 0) > 0
    const hasNonFixations = data.stylingAndLegend?.category && data.stylingAndLegend.category.length > 0
    const extraSteps: string[] = []
    if (hasEvents) extraSteps.push('Pick "No events" in Plot Settings > Events')
    if (hasNonFixations) extraSteps.push('Pick a narrower selection in Plot Settings > Eye-movement Types')
    return cannotFitPlaceholder('height', extraSteps)
  },

  draw: (ctx, scene, frame) => {
    const { data, render, layout } = scene
    drawParticipantRowAxis(ctx, data.participants.length, scene.labelColumn.labels, frame.x, render.plotTop, layout.heightOfBarWrap)
    drawScarfGrid(ctx, data, render)

    drawScarfBands(
      ctx,
      data,
      render,
      scene.rectStyleArray,
      scene.eventStyleArray,
      scene.highlightMask
    )

    drawScarfHighlightMarkers(ctx, data, render, scene.markers)

    drawLegendGroupTitles(ctx, scene.legendGeometry, LEGEND_CONFIG)
    drawLegend(ctx, scene.legendGeometry, LEGEND_CONFIG, scene.highlights)
  },

  // The PLOT CURSOR's marks plus the local CROSSHAIR, blitted over the cached
  // data layer. The cursor comes first: it must survive the local-hover gate.
  overlay: {
    key: timeCursor.key,
    draw: (ctx, scene, _frame, { hover, cursor }) => {
      const { rowBand } = scene
      const marked = timeCursor.draw(ctx, scene, cursor)
      const rows = hover ? [...marked, hover.row] : marked
      markCrosshairStrips(ctx, rowStrips(rows, rowBand, scene.layout.heightOfBarWrap, 0.2))
      if (hover) {
        const x = alignToPixelCenter(hover.x)
        strokeCrosshairGuides(ctx, [x, rowBand.y, x, rowBand.y + rowBand.height])
      }
    },
  },

  // ── Hover (harness hitTest contract; the legend band is harness-owned —
  // it attaches no `data`, so a legend hover clears the crosshair) ──
  hit: (scene, mx, my, frame, input) => {
    const { data, rowBand } = scene
    if (!inRows(rowBand, mx, my)) return null
    const rowHeight = scene.layout.heightOfBarWrap
    const plotTop = rowBand.y
    const row = Math.floor((my - plotTop) / rowHeight)
    if (row < 0 || row >= data.participants.length) return null

    // The event band hangs below the AOI seam; a pointer inside it asks about
    // the strip there, not the gaze segment sharing its x.
    const ev = findEventStripAt(scene, row, mx, my, frame)
    if (ev) {
      return {
        content: buildScarfEventTooltipContent(
          data.participants[row]?.label ?? '',
          ev.name,
          ev.start,
          ev.end,
          ev.isPoint
        ),
        anchorX: ev.anchorX,
        anchorY: row * rowHeight + rowHeight + plotTop,
        tooltipWidth: SCARF_LAYOUT.TOOLTIP_WIDTH,
        data: { row, x: mx },
      }
    }

    const seg = findSegmentAtRowAndTime(data, row, mx, frame)
    if (!seg) return trackOnlyHit({ row, x: mx })

    return {
      content: input.getTooltipContent(seg.participantId, seg.orderId),
      anchorX: frame.x + (seg.x + seg.width) * frame.width,
      anchorY: seg.y * rowHeight + rowHeight + plotTop,
      tooltipWidth: SCARF_LAYOUT.TOOLTIP_WIDTH,
      data: { row, x: mx },
    }
  },

  // The track-only hit covers empty timeline too, so the cursor follows the
  // pointer across gaps.
  hover: (hover, act) => timeCursor.publish(act, hover?.x ?? null, hover?.row ?? null),

  legend: {
    geometry: scene => (scene.data.stylingAndLegend ? scene.legendGeometry : null),
    config: LEGEND_CONFIG,
    highlights: input => input.highlights ?? [],
  },

  // The legend items' blocked rects come from the harness legend band.
  blockedRegions: ({ rowBand }) => [
    { x: rowBand.x, y: rowBand.y, w: rowBand.width, h: rowBand.height },
  ],

  // ── Pointer: legend clicks, and drag-to-pan as a draft committed on release ──
  pointer: act => {
    // Whether this press drafted a pan: a drag that never moved x commits nothing.
    let drafted = false
    return {
      onDown: p => {
        drafted = false
        const scene = act.scene()
        const item = scene && legendItemAt(scene, p.x, p.y)
        if (item) act.toggle('highlights', item.identifier)
      },
      onDrag: d => {
        const scene = act.scene()
        if (scene === null || Math.abs(d.dx) <= 0.5) return
        act.draft(panStep(act.settings(), act.input().data.timeline, d.dx, scene.canvasWidth))
        drafted = true
      },
      // A relative timeline has nothing to drag.
      ownsDragAt: (x, y) => {
        const scene = act.scene()
        return act.input().settings.timeline !== 'relative' && scene !== null && inRows(scene.rowBand, x, y)
      },
      onUp: p => {
        if (p.dragged && drafted) act.commit(panRelease(act.settings(), act.input().dataMax))
        drafted = false
      },
      dragThreshold: 5,
    }
  },
})

type PanPatch = Partial<
  Pick<ScarfPlotSettings, 'timelineStart' | 'timelineEnd' | 'ordinalStart' | 'ordinalEnd'>
>

const round3 = (v: number) => Math.round(v * 1000) / 1000

/**
 * One drag step: the window (the set range, else the drawn one) shifted by `dx`
 * canvas px of `width`, never past 0.
 */
function panStep(
  settings: ScarfPlotSettings,
  timeline: { minValue: number; maxValue: number },
  dx: number,
  width: number
): PanPatch {
  const { startKey, endKey, start, end } = scarfRange(settings)
  const min = start > 0 ? start : timeline.minValue
  const max = end > 0 ? end : timeline.maxValue
  const move = -dx * ((max - min) / width)
  const newMin = Math.max(0, min + move)
  const newMax = max + move + (newMin - (min + move))
  return { [startKey]: round3(newMin), [endKey]: round3(newMax) }
}

/** The release: the drafted range, an end at or past the data max committed as 0 (auto). */
function panRelease(settings: ScarfPlotSettings, dataMax: number): PanPatch {
  const { startKey, endKey } = scarfRange(settings)
  const start = settings[startKey]
  const end = settings[endKey]
  const patch: PanPatch = { [startKey]: start, [endKey]: end }
  if (start === 0 && end !== undefined && end >= round3(dataMax)) patch[endKey] = 0
  return patch
}

/** What the legend and event-strip hit-tests read from the scene. */
interface HitScene {
  data: ScarfData
  layout: ReturnType<typeof rowLayout>
  rowBand: RowBand
  legendGeometry: LegendGeometry
  identifierSystem: ScarfDataStyles['identifierSystem']
}

function legendItemAt(scene: HitScene, mouseX: number, mouseY: number): LegendItemGeometry | null {
  if (!scene.data.stylingAndLegend || !scene.legendGeometry.items.length) return null
  return hitTestLegend(scene.legendGeometry, LEGEND_CONFIG, mouseX, mouseY)
}

/**
 * Hit-test the event band of one row against the SAME geometry
 * paintEventStrips draws: lanes hang below the seam, intervals are
 * min-width clamped, points are min-width diamonds — so everything visible
 * is hoverable. Times un-normalize through the row's projection, giving
 * back the clipped-to-view span the strip covers.
 */
function findEventStripAt(
  scene: HitScene,
  rowIndex: number,
  mouseX: number,
  mouseY: number,
  frame: PlotFrame
) {
  const { data, layout } = scene
  const buckets = data.visualEventBuckets
  const gs = data.gazeSource
  if (!data.isOverlay || !gs || buckets.length === 0 || layout.eventLaneHeight <= 0) return null
  const yIn = mouseY - (scene.rowBand.y + rowIndex * layout.heightOfBarWrap)
  const bandTop = layout.eventBandTop
  if (yIn < bandTop || yIn >= bandTop + layout.eventZoneHeight) return null
  const lane = Math.floor((yIn - bandTop) / layout.eventLaneHeight)

  const pLeft = frame.x
  const pWidth = frame.width
  const pRight = pLeft + pWidth
  const minInterval = SCARF_LAYOUT.MIN_INTERVAL_PX
  const hw = SCARF_LAYOUT.MIN_POINT_PX / 2
  const clipMin = gs.projClipMin[rowIndex]
  const clipRange = gs.projClipMax[rowIndex] - clipMin || 1
  const { indexToId } = scene.identifierSystem

  for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
    const buffer = buckets[styleIdx]
    const count = buffer.length / OVERLAY_EVENT_STRIDE
    for (let i = 0; i < count; i++) {
      const idx = i * OVERLAY_EVENT_STRIDE
      if ((buffer[idx + 1] | 0) !== rowIndex) continue
      if ((buffer[idx + 3] | 0) !== lane) continue
      const xNorm = buffer[idx]
      const wNorm = buffer[idx + 2]
      const isPoint = (buffer[idx + 4] | 0) === 1
      const x = pLeft + xNorm * pWidth
      let anchorX: number
      if (isPoint) {
        const cx = Math.min(pRight - hw, Math.max(pLeft + hw, x))
        if (mouseX < cx - hw || mouseX > cx + hw) continue
        anchorX = cx + hw
      } else {
        let w = wNorm * pWidth
        if (w < minInterval) w = minInterval
        if (x + w > pRight) w = pRight - x
        if (w <= 0 || mouseX < x || mouseX > x + w) continue
        anchorX = x + w
      }
      const identifier = indexToId.get(styleIdx) ?? ''
      const start = clipMin + xNorm * clipRange
      return {
        name:
          data.stylingAndLegend?.event.find(e => e.identifier === identifier)
            ?.name ?? '',
        start,
        end: start + wNorm * clipRange,
        isPoint,
        anchorX,
      }
    }
  }
  return null
}

// The tooltip reads only position + identity; style/geometry resolution
// lives in core/hitTest.ts so the parity test can pin it against the
// composite's walk.
function findSegmentAtRowAndTime(data: ScarfData, rowIndex: number, mouseX: number, frame: PlotFrame) {
  if (!data.gazeSource) return null
  const xNorm = (mouseX - frame.x) / frame.width
  const hit = findGazeSegmentAt(data.gazeSource, rowIndex, xNorm)
  if (!hit) return null
  return {
    x: hit.x,
    y: rowIndex,
    width: hit.width,
    participantId: data.participants[rowIndex]?.id ?? rowIndex,
    orderId: hit.orderId,
  }
}
