export type EyeTrackingFileType = 'tobii' | 'gazepoint' | 'begaze' | 'unknown' | 'tobii-with-event' | 'ogama' | 'varjo'

export function isEyeTrackingFileType (x: unknown): x is EyeTrackingFileType {
  if (typeof x !== 'string') return false
  return ['tobii', 'gazepoint', 'begaze', 'unknown', 'tobii-with-event', 'ogama', 'varjo'].includes(x)
}
