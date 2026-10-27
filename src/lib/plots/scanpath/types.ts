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
  /** Trail length in recording ms: during playback only fixations that began
      within the last N ms stay on screen, fading with age. 0 keeps everything
      since the start (the default). */
  playbackWindow: number
  /** Playback rate relative to recording time (1 = real time). On a shared
      clock the plot that started playback sets the rate. */
  playbackSpeed: number
  /** Play on the stimulus's shared clock (in lockstep with its other
      scanpaths, playhead shown on its time-axis plots). Off = a private
      clock. */
  syncPlayback: boolean
  /** Recording-time range (ms); fixations overlapping it are drawn and the
      play bar spans it. 0/absent end = to the end of the recording. */
  timelineStart?: number
  timelineEnd?: number
}

export interface ScanpathFixation {
  /** 1-based chronological rank among the recording's located fixations
      (a time range never renumbers them). */
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
