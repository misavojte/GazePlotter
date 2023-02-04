import { WorkerSettingsMessage } from './WorkerSettingsMessage'

export interface StartButtonsPreParseSettingsType {
  workerSettings: WorkerSettingsMessage
  files: File[]
}
