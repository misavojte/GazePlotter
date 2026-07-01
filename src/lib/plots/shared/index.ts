/**
 * Shared Plot Utilities
 *
 * This module contains shared components, classes, types, and utilities
 * that are used across different plot types.
 * The entire module is exported through the main '$lib/plots' index.
 */

// Export shared components
export * from './components'

// Export shared types
export type * from './types'

// Export shared utilities
export * from './selectOptionsGetters'
export * from './plotSizeUtility'
export * from './timelineUtils'
export * from './displayBudget'
export * from './axisUtils'
export * from './canvasUtils'
export * from './plotArea'

// Export legend rendering utilities
export * from './legendRendering'
export * from './legendGradient'

// Export shared constants
export * from './const'
export * from './previewSync.svelte'
export * from './colorScalePreview'
export * from './metricInstanceHandlers'
export * from './labels'
export * from './resultShapes'
export * from './metricResolver'
export * from './PlotSyncRegistry.svelte'
export * from './usePlot.svelte'
export * from './ticks'
export * from './canvasBlockSelect.action'
export * from './matrixLayout'
export * from './matrixRenderer'
export * from './drawCanvasPlaceholder'
