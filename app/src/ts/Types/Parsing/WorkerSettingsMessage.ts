import { EyeTrackingFileType, isEyeTrackingFileType } from './FileTypes'

export function isWorkerSettingsMessage (data: unknown): data is WorkerSettingsMessage {
  if (typeof data !== 'object' || data === null) return false
  return (
    ('type' in data) && typeof data.type === 'string' && isEyeTrackingFileType(data.type) &&
      ('rowDelimiter' in data) && typeof data.rowDelimiter === 'string' &&
      ('columnDelimiter' in data) && typeof data.columnDelimiter === 'string' &&
      ('fileNames' in data) && Array.isArray(data.fileNames) &&
      ('userInputSetting' in data) && (data.userInputSetting === null || typeof data.userInputSetting === 'string')
  )
}

export interface WorkerSettingsMessage {
  type: EyeTrackingFileType
  rowDelimiter: string
  columnDelimiter: string
  fileNames: string[]
  userInputSetting: string | null
}
