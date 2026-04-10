import { PRESET_PALETTES } from '$lib/color'

export const SIMILARITY_METHODS = [
  { value: 'levenshtein' as const, label: 'Levenshtein' },
  { value: 'needlemanWunsch' as const, label: 'Needleman-Wunsch' },
] as const

export const SIMILARITY_LEGEND_TITLES: Record<string, string> = {
  levenshtein: 'Similarity [Levenshtein]',
  needlemanWunsch: 'Similarity [Needleman-Wunsch]',
}

export const SCANPATH_SIMILARITY_DEFAULTS = {
  threshold: 0.5,
  collapsed: false,
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
