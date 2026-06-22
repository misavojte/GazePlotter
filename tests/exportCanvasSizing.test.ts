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
