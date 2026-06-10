import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { RecurrenceData, RecurrenceMethod, FixationRecord } from '../types'
import { computeRqa, computeRqaWithDuration } from '$lib/metrics/core/rqa'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'

/**
 * Collect fixation records for a single participant on a stimulus.
 * Returns null if spatial data is unavailable.
 *
 * Time window: a fixation is kept when its onset falls in `[timeStart, timeEnd)`.
 * `timeEnd <= 0` means "unbounded above"; `timeStart <= 0` means "unbounded below".
 */
export function collectFixations(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  requireSpatial: boolean = true,
  timeStart: number = 0,
  timeEnd: number = 0,
): FixationRecord[] | null {
  const reader = engine.getReader()
  const meta = engine.metadata
  if (!reader || !meta) return null
  if (requireSpatial && !reader.hasSpatialData) return null

  const { startIndex, endIndex } = reader.getSegmentRange(
    stimulusId,
    participantId
  )
  const fixations: FixationRecord[] = []

  const hiddenAois = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenAoisSet = hiddenAois.length ? new Set(hiddenAois) : null
  const hasUpperBound = timeEnd > 0

  for (let segIdx = startIndex; segIdx < endIndex; segIdx++) {
    if (reader.getSegmentCategory(segIdx) !== FIXATION_CATEGORY_ID) continue

    const segStart = reader.getSegmentStart(segIdx)
    if (segStart < timeStart) continue
    if (hasUpperBound && segStart >= timeEnd) break

    const spatial = reader.getSegmentSpatial(segIdx)
    if (requireSpatial && !spatial) continue

    const duration = reader.getSegmentEnd(segIdx) - segStart

    // Collect AOI IDs for this fixation
    const rawAois = reader.getRawAois(segIdx)
    const aoiIds: number[] = []
    for (let i = 0; i < rawAois.length; i++) {
      const rawId = rawAois[i]
      if (hiddenAoisSet?.has(rawId)) continue
      aoiIds.push(engine.getAoiMapping(stimulusId, rawId))
    }

    fixations.push({
      x: spatial?.x ?? 0,
      y: spatial?.y ?? 0,
      duration,
      aoiIds,
    })
  }

  return fixations
}

/**
 * Build the NxN recurrence matrix and compute RQA metrics.
 */
export function collectRecurrenceData(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  method: RecurrenceMethod,
  radius: number,
  gridSize: number,
  showDuration: boolean,
  minLineLength: number,
  timeStart: number = 0,
  timeEnd: number = 0,
): RecurrenceData | null {
  const fixations = collectFixations(
    engine,
    stimulusId,
    participantId,
    method !== 'aoi',
    timeStart,
    timeEnd,
  )
  if (!fixations || fixations.length < 2) return null

  const N = fixations.length
  const matrix = new Uint8Array(N * N)

  switch (method) {
    case 'fixedDistance':
      buildFixedDistanceMatrix(fixations, matrix, N, radius)
      break
    case 'fixedGrid':
      buildFixedGridMatrix(fixations, matrix, N, gridSize)
      break
    case 'aoi':
      buildAoiMatrix(fixations, matrix, N)
      break
  }

  // Build duration matrix if requested
  let durationMatrix: Float32Array | null = null
  if (showDuration) {
    durationMatrix = new Float32Array(N * N)
    for (let i = 0; i < N; i++) {
      const rowOffset = i * N
      for (let j = 0; j < N; j++) {
        if (matrix[rowOffset + j]) {
          durationMatrix[rowOffset + j] =
            fixations[i].duration + fixations[j].duration
        }
      }
    }
  }

  // Compute RQA metrics
  let rqa
  if (showDuration && durationMatrix) {
    const totalDuration = fixations.reduce((sum, f) => sum + f.duration, 0)
    rqa = computeRqaWithDuration(
      matrix,
      durationMatrix,
      N,
      minLineLength,
      totalDuration
    )
  } else {
    rqa = computeRqa(matrix, N, minLineLength)
  }

  // Build per-fixation AOI colors for AOI highlight mode
  const meta = engine.metadata
  const aoiData = meta?.aois?.data?.[stimulusId] ?? []
  const fixationAoiColors: (string | null)[] = new Array(N)
  for (let i = 0; i < N; i++) {
    const aoiIds = fixations[i].aoiIds
    if (aoiIds.length > 0 && aoiData[aoiIds[0]]?.[2]) {
      fixationAoiColors[i] = aoiData[aoiIds[0]][2]
    } else {
      fixationAoiColors[i] = null
    }
  }

  return { matrix, durationMatrix, fixationCount: N, rqa, fixationAoiColors }
}

function buildFixedDistanceMatrix(
  fixations: FixationRecord[],
  matrix: Uint8Array,
  N: number,
  radius: number
): void {
  const radiusSq = radius * radius

  for (let i = 0; i < N; i++) {
    // Diagonal is always recurrent
    matrix[i * N + i] = 1
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      const dx = fixations[i].x - fixations[j].x
      const dy = fixations[i].y - fixations[j].y
      if (dx * dx + dy * dy <= radiusSq) {
        matrix[rowOffset + j] = 1
        matrix[j * N + i] = 1
      }
    }
  }
}

function buildFixedGridMatrix(
  fixations: FixationRecord[],
  matrix: Uint8Array,
  N: number,
  gridSize: number
): void {
  // Determine coordinate range
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const f of fixations) {
    if (f.x < minX) minX = f.x
    if (f.x > maxX) maxX = f.x
    if (f.y < minY) minY = f.y
    if (f.y > maxY) maxY = f.y
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const cellW = rangeX / gridSize
  const cellH = rangeY / gridSize

  // Map each fixation to a grid cell
  const cellIds = new Int32Array(N)
  for (let i = 0; i < N; i++) {
    const cx = Math.min(
      Math.floor((fixations[i].x - minX) / cellW),
      gridSize - 1
    )
    const cy = Math.min(
      Math.floor((fixations[i].y - minY) / cellH),
      gridSize - 1
    )
    cellIds[i] = cy * gridSize + cx
  }

  for (let i = 0; i < N; i++) {
    matrix[i * N + i] = 1
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      if (cellIds[i] === cellIds[j]) {
        matrix[rowOffset + j] = 1
        matrix[j * N + i] = 1
      }
    }
  }
}

function buildAoiMatrix(
  fixations: FixationRecord[],
  matrix: Uint8Array,
  N: number
): void {
  for (let i = 0; i < N; i++) {
    matrix[i * N + i] = 1
    if (fixations[i].aoiIds.length === 0) continue

    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      if (fixations[j].aoiIds.length === 0) continue

      // Check if any AOI is shared
      const shared = fixations[i].aoiIds.some(aoi => fixations[j].aoiIds.includes(aoi))

      if (shared) {
        matrix[rowOffset + j] = 1
        matrix[j * N + i] = 1
      }
    }
  }
}
