import { computeSquareMatrixLayout, MATRIX_LAYOUT } from '$lib/plots/shared'
import type { SquareMatrixLayout, CanvasPlotMargins } from '$lib/plots/shared'

export type { SquareMatrixLayout as SimilarityMatrixLayout }

export type SimilarityMatrixLayoutInput = {
  width: number
  height: number
  labels: string[]
  effectiveMaxValue: number
  margins: CanvasPlotMargins
}

export function computeSimilarityMatrixLayout(
  input: SimilarityMatrixLayoutInput
): SquareMatrixLayout {
  return computeSquareMatrixLayout({
    width: input.width,
    height: input.height,
    labels: input.labels,
    cellValueLabelLength: 4,
    layoutConfig: MATRIX_LAYOUT,
    margins: input.margins,
  })
}
