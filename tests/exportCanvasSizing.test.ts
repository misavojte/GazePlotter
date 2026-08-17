import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS_EXPORT_MARGIN,
  getWorkspaceCanvasExportDimensions,
} from '$lib/modals/export/shared/helpers'

const gridConfig = {
  cellSize: { width: 40, height: 40 },
  gap: 10,
  minWidth: 3,
  minHeight: 3,
}

describe('getWorkspaceCanvasExportDimensions', () => {
  it('adds the default 20px margin around the workspace figure area', () => {
    // Grid px: 12 cells = 12 * 40 + 11 * 10 = 590 each way.
    // Width: 590 - 50 body padding = 540, + 2 * 20 margin = 580.
    // Height: 590 - 99 chrome (PLOT_BASE_CHROME_HEIGHT), + 40 margin = 531.
    expect(
      getWorkspaceCanvasExportDimensions(
        { w: 12, h: 12 },
        gridConfig,
        DEFAULT_CANVAS_EXPORT_MARGIN
      )
    ).toEqual({
      width: 580,
      height: 531,
    })
  })

  it('keeps dimensions positive after margins for the smallest grid item sizes', () => {
    // Width: 1 cell = 40 px - 50 padding goes negative, floored to 1, + 40 = 41.
    // Height: 3 cells = 140 px - 99 chrome = 41, + 40 = 81.
    expect(
      getWorkspaceCanvasExportDimensions(
        { w: 1, h: 3 },
        gridConfig,
        DEFAULT_CANVAS_EXPORT_MARGIN
      )
    ).toEqual({
      width: 41,
      height: 81,
    })
  })
})
