import { AXIS_CONFIG, Y_AXIS } from '../const'

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
  const padded = Math.max(1, dataHalfRange * Y_AXIS.HEADROOM_FACTOR)
  const rawStep = padded / Math.max(1, Y_AXIS.TARGET_POSITIVE_TICKS)
  const step = niceStep(rawStep)
  const axisHalfRange = Math.max(1, Math.ceil(padded / step) * step)

  const ticks: number[] = [0]
  for (let v = step; v <= axisHalfRange + step * 0.001; v += step) {
    ticks.push(v)
  }

  return { axisHalfRange, ticks }
}
