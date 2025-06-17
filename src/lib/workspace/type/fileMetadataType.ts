import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType'

export interface FileMetadataType {
  fileNames: string[]
  settings: EyeSettingsType
  parseDate: string // YYYY-MM-DD HH:MM:SS
  parseDuration: number // seconds
}
