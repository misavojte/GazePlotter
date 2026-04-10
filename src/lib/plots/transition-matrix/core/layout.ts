import { computeSquareMatrixLayout, MATRIX_LAYOUT } from '$lib/plots/shared'
import type { SquareMatrixLayout } from '$lib/plots/shared'

export type { SquareMatrixLayout as TransitionMatrixLayout }

export type TransitionMatrixLayoutInput = {
  width: number
  height: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  aoiLabels: string[]
  effectiveMaxValue: number
}

function formatCellValue(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1)
}

export function computeTransitionMatrixLayout(
  input: TransitionMatrixLayoutInput
): SquareMatrixLayout {
  const valueStr = formatCellValue(input.effectiveMaxValue)
  const labelLen = Math.max(valueStr.length, input.effectiveMaxValue < 1 ? 3 : 0)

  return computeSquareMatrixLayout({
    width: input.width,
    height: input.height,
    labels: input.aoiLabels,
    cellValueLabelLength: labelLen,
    layoutConfig: MATRIX_LAYOUT,
    marginTop: input.marginTop,
    marginRight: input.marginRight,
    marginBottom: input.marginBottom,
    marginLeft: input.marginLeft,
  })
}
