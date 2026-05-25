import type { PlotItemContract } from '$lib/plots/definePlot'

export type ScanpathPlotSettings = {
  stimulusId: number
  participantId: number
  showFixationOrder: boolean
  showNumbers: boolean
}

export type ScanpathPlotItem = PlotItemContract<'scanpath', ScanpathPlotSettings>

export interface ScanpathFixation {
  /** 1-based chronological rank within the rendered set. */
  rank: number
  x: number
  y: number
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
