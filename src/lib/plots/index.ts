// Export all modules through a central interface
// This allows importing like: import { ScarfPlotFigure, transformDataToScarfPlot } from '$lib/plots'

// Export shared components and utilities
export * from './shared'
export * from './definePlot'
export * from './registry'

// Export visualization types
export * from './transition-matrix'
export * from './scarf'
export * from './bar'
export * from './aoi-stream'
export * from './scanpath-similarity'
export * from './evolving-metrics'
export * from './recurrence'
export * from './metric-correlation'

