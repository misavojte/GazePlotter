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
    measureText(text: string) {
      return { width: text.length * 6 }
    },
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

/**
 * A permissive 2D context for kit draw tests: every method exists, is counted
 * and records its arguments; every property assignment is kept, so a test reads
 * back the last `fillStyle` like a real context. `measureText` answers 6 px per
 * character so layout code runs without a canvas.
 */
export function recordingContext() {
  const calls: { method: string; args: unknown[] }[] = []
  const props: Record<string, unknown> = {}
  const count = (method: string) => calls.filter(c => c.method === method).length
  const ctx = new Proxy(props, {
    get(target, key) {
      if (typeof key === 'symbol') return undefined
      if (key in target) return target[key]
      if (key === 'measureText') {
        return (text: string) => {
          calls.push({ method: key, args: [text] })
          return { width: text.length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }
        }
      }
      if (key === 'getLineDash') return () => []
      if (key === 'canvas') return { width: 0, height: 0 }
      if (key.startsWith('create')) {
        // Gradients, patterns and image data: a stub that takes stops and pixels.
        return (...args: unknown[]) => {
          calls.push({ method: key, args })
          return { addColorStop() {}, data: new Uint8ClampedArray(4) }
        }
      }
      return (...args: unknown[]) => {
        calls.push({ method: key, args })
      }
    },
    set(target, key, value) {
      if (typeof key === 'string') target[key] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, count }
}
