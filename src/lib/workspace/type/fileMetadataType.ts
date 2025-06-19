import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType'

export interface FileInputType {
  fileNames: string[]
  fileSizes: number[] // bytes
  parseDate: string // YYYY-MM-DD HH:MM:SS in UTC
}

export interface FileMetadataType extends FileInputType {
  parseSettings: EyeSettingsType
  parseDuration: number // seconds
  gazePlotterVersion: string
  clientUserAgent: string // e.g. "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}
