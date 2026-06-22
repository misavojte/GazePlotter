import { PRESET_PALETTES } from '$lib/color'

export const SCANPATH_SIMILARITY_DEFAULTS = {
  threshold: 0.5,
  colorScale: [...PRESET_PALETTES.BLUE.colors],
} as const

export { MATRIX_LAYOUT as SIMILARITY_MATRIX_LAYOUT } from '$lib/plots/shared'

export const SCANGRAPH_LAYOUT = {
  nodeRadius: 6,
  linkColor: '#999',
  linkOpacity: 0.6,
  chargeStrength: -120,
  linkDistance: 60,
} as const
