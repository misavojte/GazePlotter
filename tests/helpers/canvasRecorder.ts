/**
 * Shared recording 2D-context stub for draw-call assertions. Each channel
 * records exactly what some test asserts on; everything else no-ops.
 */

export interface RecordedArc {
  cx: number
  cy: number
  r: number
}

export interface RecordedFillRect {
  x: number
  y: number
  w: number
  h: number
}

export function canvasRecorder() {
  /** moveTo/lineTo coordinates, flat [x, y, ...] (line/band segments). */
  const points: number[] = []
  /** rect() args, flat [x, y, w, h, ...] (clip regions and fill subpaths). */
  const rects: number[] = []
  /** fillRect() calls (painted bands). */
  const fillRects: RecordedFillRect[] = []
  /** setLineDash() patterns. */
  const dashes: number[][] = []
  /** Every arc() centre/radius. */
  const arcs: RecordedArc[] = []
  /** One entry per fill() call. */
  const fills: number[] = []
  /** lineWidth at each stroke() call. */
  const strokes: { lw: number }[] = []
  /** The last arc pending at each fill()/stroke(): splits dots from rings. */
  const filledArcs: RecordedArc[] = []
  const strokedArcs: RecordedArc[] = []
  let pending: RecordedArc | null = null

  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    clip() {},
    fillText() {},
    setLineDash(d: number[]) {
      dashes.push(d)
    },
    rect(x: number, y: number, w: number, h: number) {
      rects.push(x, y, w, h)
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fillRects.push({ x, y, w, h })
    },
    arc(cx: number, cy: number, r: number) {
      pending = { cx, cy, r }
      arcs.push(pending)
    },
    moveTo(x: number, y: number) {
      points.push(x, y)
    },
    lineTo(x: number, y: number) {
      points.push(x, y)
    },
    fill() {
      fills.push(1)
      if (pending) filledArcs.push(pending)
    },
    stroke() {
      strokes.push({ lw: this.lineWidth })
      if (pending) strokedArcs.push(pending)
    },
  }

  return {
    points,
    rects,
    fillRects,
    dashes,
    arcs,
    fills,
    strokes,
    filledArcs,
    strokedArcs,
    ctx: ctx as unknown as CanvasRenderingContext2D,
  }
}
