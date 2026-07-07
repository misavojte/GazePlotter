import { Y_AXIS } from '../const'
import { ceilToNiceStep } from '$lib/plots/shared/timelineUtils'

export const computeNiceYAxis = (dataHalfRange: number) => {
  // Visual extent hugs the data with a fixed margin of `HEADROOM_FACTOR − 1`.
  // The axis edge is NOT snapped up to a nice-tick multiple — doing that
  // (`ceil(padded/step)·step`) inflated the margin unpredictably (often ~50%,
  // and it swallowed any change to HEADROOM_FACTOR). Nice ticks are placed WITHIN
  // this extent instead, so the band fills a consistent, predictable fraction.
  const axisHalfRange = Math.max(1, dataHalfRange * Y_AXIS.HEADROOM_FACTOR)
  const rawStep = axisHalfRange / Math.max(1, Y_AXIS.TARGET_POSITIVE_TICKS)
  const step = ceilToNiceStep(rawStep)

  const ticks: number[] = [0]
  for (let v = step; v <= axisHalfRange + step * 0.001; v += step) {
    ticks.push(v)
  }

  return { axisHalfRange, ticks }
}
