import type { AllGridTypes } from '../type'
import type { GridConfig } from './types'

/**
 * Initial layout of visualizations used when no custom state is provided.
 */
export const DEFAULT_GRID_STATE_DATA: Array<
  Partial<AllGridTypes> & { type: AllGridTypes['type'] }
> = [
  { type: 'scarf', x: 0, y: 0 },
  { type: 'transitionMatrix', x: 20, y: 0, w: 12, h: 12 },
  { type: 'barPlot', x: 0, y: 12, w: 12, h: 12 },
  { type: 'aoiStreamPlot', x: 12, y: 12, w: 12, h: 12 },
]

// Default grid configuration
export const DEFAULT_GRID_CONFIG: GridConfig = {
  cellSize: { width: 40, height: 40 },
  gap: 10,
  minWidth: 3,
  minHeight: 3,
}

// --- Constants ---
export const WORKSPACE_BOTTOM_PADDING = 90
export const WORKSPACE_RIGHT_PADDING = 0
export const MIN_WORKSPACE_HEIGHT = 300 // Also used as fallback in height calculation
export const DEFAULT_WORKSPACE_WIDTH = 1000
