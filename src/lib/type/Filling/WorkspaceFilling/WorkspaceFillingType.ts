import type { ScarfSettingsType } from '$lib/type/Settings/ScarfSettings/ScarfSettingsType'

/**
 * Fillings for the workspace determining position and width (via grid columns) of items in the workspace.
 * Such as scarf plots, loading screens, and empty spaces.
 */
export interface WorkspaceFillingType {
  id: number
  x: number
  y: number
  w: number
  h: number
  content: 'load' | 'empty' | ScarfSettingsType
}
