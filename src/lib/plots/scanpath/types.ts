export type ScanpathPlotSettings = {
  stimulusId: number
  participantId: number
  showFixationOrder: boolean
  showNumbers: boolean
  /** Fixation marker coloring: a gradient over the recording's time extent
      (default) or one solid color. */
  colorMode: 'time' | 'solid'
  /** Gradient stops for the time-extent coloring (shared colorScale field). */
  colorScale: string[]
  /** Trailing playback window in recording ms: while playing, only fixations
      that began within the last N ms stay on screen. 0 keeps everything since
      the start (the default). */
  playbackWindow: number
  /** Playback clock rate relative to recording time (1 = real time). Drives
      the rAF clock and the video's playbackRate. */
  playbackSpeed: number
}

export interface ScanpathFixation {
  /** 1-based chronological rank within the rendered set. */
  rank: number
  x: number
  y: number
  /** Onset in recording time (ms) — for the hover tooltip. */
  start: number
  /** Fixation duration in the workspace's native time units (ms). */
  duration: number
}

export interface ScanpathBBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ScanpathData {
  fixations: ScanpathFixation[]
  bbox: ScanpathBBox
  /** min/max duration across rendered fixations (≥ 0; equal if N === 1). */
  minDuration: number
  maxDuration: number
}

export type ScanpathUnavailableReason =
  | 'no-spatial-data'
  | 'no-fixations'
  | 'no-spatial-coords'

export type ScanpathTransformResult =
  | { kind: 'ok'; data: ScanpathData }
  | { kind: 'unavailable'; reason: ScanpathUnavailableReason }
