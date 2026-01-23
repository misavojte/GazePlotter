import { FLOW_CURVE_TENSION } from '../const'

export function drawCatmullRom(
  ctx: CanvasRenderingContext2D,
  xs: Float32Array,
  ys: Float32Array,
  forward: boolean,
  count: number
) {
  if (count === 0) return
  if (count === 1) {
    ctx.lineTo(xs[0], ys[0])
    return
  }

  const getX = (i: number) => (forward ? xs[i] : xs[count - 1 - i])
  const getY = (i: number) => (forward ? ys[i] : ys[count - 1 - i])

  ctx.lineTo(getX(0), getY(0))

  if (FLOW_CURVE_TENSION === 0) {
    for (let i = 1; i < count; i++) {
      ctx.lineTo(getX(i), getY(i))
    }
    return
  }

  for (let i = 0; i < count - 1; i++) {
    const p0x = getX(Math.max(0, i - 1))
    const p0y = getY(Math.max(0, i - 1))
    const p1x = getX(i)
    const p1y = getY(i)
    const p2x = getX(i + 1)
    const p2y = getY(i + 1)
    const p3x = getX(Math.min(count - 1, i + 2))
    const p3y = getY(Math.min(count - 1, i + 2))

    const cp1x = p1x + (p2x - p0x) * FLOW_CURVE_TENSION
    const cp1y = p1y + (p2y - p0y) * FLOW_CURVE_TENSION
    const cp2x = p2x - (p3x - p1x) * FLOW_CURVE_TENSION
    const cp2y = p2y - (p3y - p1y) * FLOW_CURVE_TENSION

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y)
  }
}
