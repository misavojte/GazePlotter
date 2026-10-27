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
  /** Marker fill in 'solid' mode. */
  solidColor: string
  /** Trail length in ms: during playback only fixations that began within
      it stay on screen, fading with age. 0 = all. */
  playbackWindow: number
  /** Relative to recording time. On a shared clock, the plot that started
      playback sets it. */
  playbackSpeed: number
  /** Play on the stimulus's shared clock; off = a private one. */
  syncPlayback: boolean
  /** Recording-time range (ms) of the fixations drawn; 0 end = to the end. */
  timelineStart?: number
  timelineEnd?: number
}

export interface ScanpathFixation {
  /** 1-based rank among the recording's located fixations; a time range
      never renumbers them. */
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
  | 'none-in-range'

export type ScanpathTransformResult =
  | { kind: 'ok'; data: ScanpathData }
  | { kind: 'unavailable'; reason: ScanpathUnavailableReason }
