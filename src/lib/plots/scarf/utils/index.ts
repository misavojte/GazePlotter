/**
 * Scarf Plot Utilities
 *
 * This module exports all utility functions and constants for the scarf plot components.
 */

// Export core transformation utilities
export * from './transformations'

// Export scarf plot layout, calculations and services
export * from './scarfServices'

// Export interactive and UI-related services
export * from './tooltip'
export * from './scarfSelectService'

// Direct re-exports of commonly used functions for convenience
export {
  transformDataToScarfPlot,
  getScarfParticipantBarHeight,
} from './transformations'
