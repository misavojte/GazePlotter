import { Y_AXIS } from '../const'

export const niceStep = (rawStep: number) => {
  const safeRaw = Math.max(1e-9, Math.abs(rawStep))
  const exponent = Math.floor(Math.log10(safeRaw))
  const pow10 = Math.pow(10, exponent)
  const fraction = safeRaw / pow10
  const niceFractions = [1, 2, 2.5, 5, 10]
  let niceFraction = niceFractions[niceFractions.length - 1]
  for (let i = 0; i < niceFractions.length; i++) {
    if (fraction <= niceFractions[i]) {
      niceFraction = niceFractions[i]
      break
    }
  }
  return niceFraction * pow10
}

export const computeNiceYAxis = (dataHalfRange: number) => {
  // Visual extent hugs the data with a fixed margin of `HEADROOM_FACTOR − 1`.
  // The axis edge is NOT snapped up to a nice-tick multiple — doing that
  // (`ceil(padded/step)·step`) inflated the margin unpredictably (often ~50%,
  // and it swallowed any change to HEADROOM_FACTOR). Nice ticks are placed WITHIN
  // this extent instead, so the band fills a consistent, predictable fraction.
  const axisHalfRange = Math.max(1, dataHalfRange * Y_AXIS.HEADROOM_FACTOR)
  const rawStep = axisHalfRange / Math.max(1, Y_AXIS.TARGET_POSITIVE_TICKS)
  const step = niceStep(rawStep)

  const ticks: number[] = [0]
  for (let v = step; v <= axisHalfRange + step * 0.001; v += step) {
    ticks.push(v)
  }

  return { axisHalfRange, ticks }
}
