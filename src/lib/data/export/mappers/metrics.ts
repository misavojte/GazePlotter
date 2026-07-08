import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  getParticipant,
  getParticipantEndTime,
  getStimulus,
  getAois,
  getStimulusHighestEndTime,
} from '$lib/data/engine'
import {
  queryBatch,
  queryGroup,
  type MetricInstance,
  type Scope,
  type GroupScope,
  formatProjectionReadout,
  formatParamReadout,
  defaultInstanceLabel,
  getMetric,
  instanceMatchesContract,
  projectionOutputShape,
  windowLabel,
} from '$lib/metrics'
import {
  formatNumberForCsv,
  generateCsvString,
  type CsvFormatOptions,
  resolveCsvFormatOptions,
} from '../encoders/csv'
import type { PlotMetricContract } from '$lib/metrics/filters'

export const METRIC_EXPORT_CONTRACT_LONG: PlotMetricContract = {
  outputShape: ['scalar', 'aoi-vector', 'aoi-pair-matrix', 'participant-pair-matrix'],
  windowing: 'allowed',
  crossParticipant: 'per-participant',
  multiSelect: true,
}

export const METRIC_EXPORT_CONTRACT_WIDE: PlotMetricContract = {
  outputShape: [
    'scalar',
    'aoi-vector',
    'aoi-pair-matrix',
    'participant-pair-matrix',
  ],
  windowing: 'forbidden',
  crossParticipant: 'per-participant',
  multiSelect: true,
}

export type MetricDataExportOptions = {
  fileName: string
  /** Explicit participant selection, in engine order. Participant groups are a
   *  SELECTION tool in the modal, never an export parameter — the export
   *  receives exactly the participants it emits. */
  participantIds: number[]
  stimulusIds: number[]
  metricInstanceIds: string[]
  format: 'long' | 'wide'
  csvOptions?: CsvFormatOptions
  timeStart?: number
  timeEnd?: number
  includeCodebook?: boolean
}

function getAoiSlotName(
  slotIndex: number,
  slots: { noAoiSlot: number; anyFixationSlot: number },
  aoiNames: readonly string[]
): string {
  if (slotIndex === slots.noAoiSlot) return 'No_AOI'
  if (slotIndex === slots.anyFixationSlot) return 'Any_Fixation'
  return aoiNames[slotIndex] ?? `Slot_${slotIndex}`
}

function getMatrixSlotName(slotIndex: number, aoiNames: readonly string[]): string {
  if (slotIndex === aoiNames.length) return 'No_AOI'
  return aoiNames[slotIndex] ?? `Slot_${slotIndex}`
}

/**
 * Unique display label per instance id, in instance order. Collision-proof:
 * a suffixed candidate is re-checked against every name already assigned, so
 * a base label that itself ends in `(n)` can never produce a duplicate.
 * Shared by the mapper and the modal's format preview so the previewed names
 * always equal the exported ones.
 */
export function deduplicateMetricLabels(
  instances: readonly MetricInstance[]
): Map<string, string> {
  const used = new Set<string>()
  const resolved = new Map<string, string>()
  for (const inst of instances) {
    const base = inst.label || defaultInstanceLabel(inst.baseId)
    let candidate = base
    for (let n = 2; used.has(candidate); n++) candidate = `${base} (${n})`
    used.add(candidate)
    resolved.set(inst.id, candidate)
  }
  return resolved
}

/**
 * Column layout of the long-format export, derived from the selected
 * instances' projection shapes. Shared by the mapper and the modal's format
 * preview so the previewed column list always equals the exported one.
 */
export function longFormatMetricColumns(
  instances: readonly MetricInstance[]
): {
  header: string[]
  needWindow: boolean
  needAoi: boolean
  needMatrix: boolean
  needParticipantB: boolean
} {
  const shapes = instances.map(inst => projectionOutputShape(inst.projection))
  const needWindow = shapes.some(s => s === 'scalar-timeseries' || s === 'aoi-vector-timeseries')
  const needAoi = shapes.some(s => s === 'aoi-vector' || s === 'aoi-vector-timeseries')
  const needMatrix = shapes.some(s => s === 'aoi-pair-matrix')
  const needParticipantB = shapes.some(s => s === 'participant-pair-matrix')

  const header = ['Participant_ID', 'Participant', 'Stimulus']
  if (needWindow) header.push('Window_Start', 'Window_End')
  if (needAoi) header.push('AOI')
  if (needMatrix) header.push('From_AOI', 'To_AOI')
  if (needParticipantB) header.push('Participant_B')
  header.push('Metric', 'Unit', 'Value')

  return { header, needWindow, needAoi, needMatrix, needParticipantB }
}

type LongRowBuilderParams = {
  participantId: number
  participantName: string
  stimulusName: string
  needWindow: boolean
  windowStart?: number
  windowEnd?: number
  needAoi: boolean
  aoi?: string
  needMatrix: boolean
  fromAoi?: string
  toAoi?: string
  needParticipantB: boolean
  participantB?: string
  metric: string
  unit: string
  value: string
}

function buildLongRow(p: LongRowBuilderParams): string[] {
  const row: string[] = [p.participantId.toString(), p.participantName, p.stimulusName]
  if (p.needWindow) {
    row.push(
      p.windowStart !== undefined ? p.windowStart.toString() : '',
      p.windowEnd !== undefined ? p.windowEnd.toString() : ''
    )
  }
  if (p.needAoi) {
    row.push(p.aoi ?? '')
  }
  if (p.needMatrix) {
    row.push(p.fromAoi ?? '', p.toAoi ?? '')
  }
  if (p.needParticipantB) {
    row.push(p.participantB ?? '')
  }
  row.push(p.metric, p.unit, p.value)
  return row
}

export async function generateMetricExport(
  engine: DataEngine,
  options: MetricDataExportOptions,
  onProgress?: (position: number, total: number, name: string) => void | Promise<void>
): Promise<{
  dataContent: string
  codebookContent: string | null
  rows: number
  metricCount: number
  stimulusCount: number
}> {
  const { decimalSeparator } = resolveCsvFormatOptions(options.csvOptions)
  const timeStart = options.timeStart ?? 0
  const timeEnd = options.timeEnd ?? 0
  if (
    !Number.isFinite(timeStart) ||
    !Number.isFinite(timeEnd) ||
    timeStart < 0 ||
    timeEnd < 0
  ) {
    throw new Error('Time range must be a non-negative number of milliseconds')
  }
  if (timeEnd > 0 && timeEnd <= timeStart) {
    throw new Error('Time end must be greater than time start')
  }
  const includeCodebook = !!options.includeCodebook

  const selectedInstances = options.metricInstanceIds
    .map(id => engine.metadata?.metricInstances.find(i => i.id === id))
    .filter((inst): inst is MetricInstance => !!inst)

  // The format's contract is enforced HERE, not only in the modal UI: an
  // incompatible instance is an explicit error, never a silently missing
  // column (request === result, and no discarded windowed computation).
  const contract =
    options.format === 'long' ? METRIC_EXPORT_CONTRACT_LONG : METRIC_EXPORT_CONTRACT_WIDE
  const incompatible = selectedInstances.filter(
    inst => !instanceMatchesContract(inst, contract)
  )
  if (incompatible.length > 0) {
    const names = incompatible
      .map(inst => inst.label || defaultInstanceLabel(inst.baseId))
      .join(', ')
    throw new Error(`Not exportable in ${options.format} format: ${names}`)
  }

  const resolvedLabels = deduplicateMetricLabels(selectedInstances)
  const aoiMissingMap = new Map<string, boolean>()
  const dataRows: string[][] = []

  if (options.format === 'long') {
    const { header, needWindow, needAoi, needMatrix, needParticipantB } =
      longFormatMetricColumns(selectedInstances)

    const relationalInstances = selectedInstances.filter(inst => {
      const shape = projectionOutputShape(inst.projection)
      return shape === 'participant-pair-matrix'
    })
    const plainAndWindowedInstances = selectedInstances.filter(inst => {
      const shape = projectionOutputShape(inst.projection)
      return shape !== 'participant-pair-matrix'
    })

    let count = 0
    const total = options.stimulusIds.length * options.participantIds.length

    for (const stimulusId of options.stimulusIds) {
      const stimulus = getStimulus(engine, stimulusId)
      const stimulusName = stimulus.displayedName
      const participantIds = options.participantIds
      const aoiNames = getAois(engine, stimulusId).map(a => a.displayedName)
      const effectiveTimeEnd = timeEnd > 0 ? timeEnd : getStimulusHighestEndTime(engine, stimulusId)

      // Plain/Windowed
      for (const participantId of participantIds) {
        count++
        const participant = getParticipant(engine, participantId)
        const participantName = participant.displayedName

        if (onProgress) {
          await onProgress(count, total, `Computing metrics for ${participantName} · ${stimulusName}`)
          await new Promise(resolve => setTimeout(resolve, 0))
        }

        // Clamp to the participant's own recording end so windowed timelines
        // stay ragged per participant: a short recording must not receive
        // fabricated zero-value windows up to the stimulus-global end (the
        // evolving-metrics pattern). Plain metrics are unaffected — no segment
        // exists past the participant's end, so the clip is a no-op for them.
        const participantEnd = getParticipantEndTime(engine, stimulusId, participantId)
        const scope: Scope = {
          engine,
          stimulusId,
          participantId,
          timeStart,
          timeEnd: Math.min(effectiveTimeEnd, participantEnd),
        }

        const batchResult = queryBatch(plainAndWindowedInstances, scope)

        for (const inst of plainAndWindowedInstances) {
          const result = batchResult.get(inst.id)
          if (!result) continue

          if (result.provenance.aoiMissing) {
            aoiMissingMap.set(inst.id, true)
          }

          const label = resolvedLabels.get(inst.id) ?? inst.label
          const unit = result.unit

          if (result.shape === 'scalar') {
            const valStr = formatNumberForCsv(result.value, decimalSeparator)
            dataRows.push(
              buildLongRow({
                participantId,
                participantName,
                stimulusName,
                needWindow,
                needAoi,
                needMatrix,
                needParticipantB,
                metric: label,
                unit,
                value: valStr,
              })
            )
          } else if (result.shape === 'aoi-vector') {
            const slots = result.slots
            for (let s = 0; s < slots.totalSlots; s++) {
              const val = result.values[s]
              const valStr = formatNumberForCsv(val, decimalSeparator)
              const aoiName = getAoiSlotName(s, slots, aoiNames)
              dataRows.push(
                buildLongRow({
                  participantId,
                  participantName,
                  stimulusName,
                  needWindow,
                  needAoi,
                  needMatrix,
                  needParticipantB,
                  aoi: aoiName,
                  metric: label,
                  unit,
                  value: valStr,
                })
              )
            }
          } else if (result.shape === 'aoi-pair-matrix') {
            const side = result.size
            for (let fromSlot = 0; fromSlot < side; fromSlot++) {
              for (let toSlot = 0; toSlot < side; toSlot++) {
                const val = result.matrix[fromSlot * side + toSlot]
                const valStr = formatNumberForCsv(val, decimalSeparator)
                const fromAoi = getMatrixSlotName(fromSlot, aoiNames)
                const toAoi = getMatrixSlotName(toSlot, aoiNames)
                dataRows.push(
                  buildLongRow({
                    participantId,
                    participantName,
                    stimulusName,
                    needWindow,
                    needAoi,
                    needMatrix,
                    needParticipantB,
                    fromAoi,
                    toAoi,
                    metric: label,
                    unit,
                    value: valStr,
                  })
                )
              }
            }
          } else if (result.shape === 'scalar-timeseries') {
            const windowSize =
              inst.projection.kind === 'windowed' ? inst.projection.window.windowSize : 0
            for (let w = 0; w < result.timeline.length; w++) {
              const tStart = result.timeline[w]
              const tEnd = tStart + windowSize
              const val = result.values[w]
              const valStr = formatNumberForCsv(val, decimalSeparator)
              dataRows.push(
                buildLongRow({
                  participantId,
                  participantName,
                  stimulusName,
                  needWindow,
                  needAoi,
                  needMatrix,
                  needParticipantB,
                  windowStart: tStart,
                  windowEnd: tEnd,
                  metric: label,
                  unit,
                  value: valStr,
                })
              )
            }
          } else if (result.shape === 'aoi-vector-timeseries') {
            const windowSize =
              inst.projection.kind === 'windowed' ? inst.projection.window.windowSize : 0
            const slots = result.slots
            for (let w = 0; w < result.timeline.length; w++) {
              const tStart = result.timeline[w]
              const tEnd = tStart + windowSize
              const vector = result.vectors[w] ?? []
              for (let s = 0; s < slots.totalSlots; s++) {
                const val = vector[s]
                const valStr = formatNumberForCsv(val, decimalSeparator)
                const aoiName = getAoiSlotName(s, slots, aoiNames)
                dataRows.push(
                  buildLongRow({
                    participantId,
                    participantName,
                    stimulusName,
                    needWindow,
                    needAoi,
                    needMatrix,
                    needParticipantB,
                    windowStart: tStart,
                    windowEnd: tEnd,
                    aoi: aoiName,
                    metric: label,
                    unit,
                    value: valStr,
                  })
                )
              }
            }
          }
        }
      }

      // Relational
      if (relationalInstances.length > 0) {
        const groupScope: GroupScope = { engine, stimulusId, participantIds, timeStart, timeEnd: effectiveTimeEnd }
        for (const inst of relationalInstances) {
          const result = queryGroup(inst, groupScope)
          if (result.shape !== 'participant-pair-matrix') continue

          if (result.provenance.aoiMissing) {
            aoiMissingMap.set(inst.id, true)
          }

          const label = resolvedLabels.get(inst.id) ?? inst.label
          const unit = result.unit
          const size = result.size
          const resParticipantIds = result.participantIds
          const resParticipantNames = resParticipantIds.map(
            id => getParticipant(engine, id).displayedName
          )

          for (let i = 0; i < size; i++) {
            const pAId = resParticipantIds[i]
            const pAName = resParticipantNames[i]

            for (let j = i + 1; j < size; j++) {
              const pBName = resParticipantNames[j]

              const val = result.matrix[i * size + j]
              const valStr = formatNumberForCsv(val, decimalSeparator)

              dataRows.push(
                buildLongRow({
                  participantId: pAId,
                  participantName: pAName,
                  stimulusName,
                  needWindow,
                  needAoi,
                  needMatrix,
                  needParticipantB,
                  participantB: pBName,
                  metric: label,
                  unit,
                  value: valStr,
                })
              )
            }
          }
        }
      }
    }

    return buildResponse(generateCsvString(header, dataRows, options.csvOptions))
  } else {
    // WIDE format
    //
    // Column identity is by AOI displayedName: same displayedName = the same
    // functional AOI, within a stimulus (the engine's `getAois` already merges
    // and dedupes by displayed name) and ACROSS stimuli (the app's
    // user-controlled-naming paradigm — a "Face" column collects Face from
    // every selected stimulus). The synthetic No AOI / Any fixation columns
    // are typed slots, not name strings, so a real AOI displayed-named
    // "No_AOI" keeps its own column instead of hijacking the synthetic one.
    type WideAoiRef =
      | { kind: 'name'; name: string }
      | { kind: 'noAoi' }
      | { kind: 'anyFixation' }
    type WideColumn =
      | { type: 'scalar'; id: string; metricId: string; header: string }
      | { type: 'aoi-vector'; id: string; metricId: string; header: string; aoi: WideAoiRef }
      | {
          type: 'aoi-pair-matrix'
          id: string
          metricId: string
          header: string
          fromAoi: WideAoiRef
          toAoi: WideAoiRef
        }
      // A relational metric IS a matrix over participants, so its wide layout
      // is the matrix grid: the row is participant A, one column per
      // participant B (the layout the former standalone scanpath-similarity
      // export produced). Values are emitted verbatim from the group result,
      // including the diagonal.
      | {
          type: 'participant-pair'
          id: string
          metricId: string
          header: string
          otherParticipantId: number
        }

    // Union of displayed AOI names across the selected stimuli, in first-seen
    // order (stable, selection-order dependent). Computed ONCE.
    const unionAoiNames: string[] = []
    {
      const seen = new Set<string>()
      for (const stimulusId of options.stimulusIds) {
        for (const aoi of getAois(engine, stimulusId)) {
          if (!seen.has(aoi.displayedName)) {
            seen.add(aoi.displayedName)
            unionAoiNames.push(aoi.displayedName)
          }
        }
      }
    }

    // Column axis for relational (participant-pair) metrics: the explicit
    // participant selection (deduplicated defensively).
    const unionParticipantIds = Array.from(new Set(options.participantIds))

    const aoiRefText = (ref: WideAoiRef): string =>
      ref.kind === 'name' ? ref.name : ref.kind === 'noAoi' ? 'No_AOI' : 'Any_Fixation'
    const aoiRefKey = (ref: WideAoiRef): string =>
      ref.kind === 'name' ? `name:${ref.name}` : ref.kind

    const rawColumns: WideColumn[] = []

    for (const inst of selectedInstances) {
      const label = resolvedLabels.get(inst.id) ?? inst.label
      const shape = projectionOutputShape(inst.projection)

      if (shape === 'scalar') {
        rawColumns.push({
          type: 'scalar',
          id: inst.id,
          metricId: inst.id,
          header: label,
        })
      } else if (shape === 'aoi-vector') {
        const refs: WideAoiRef[] = [
          ...unionAoiNames.map(name => ({ kind: 'name', name }) as const),
          { kind: 'noAoi' },
          { kind: 'anyFixation' },
        ]
        for (const aoi of refs) {
          rawColumns.push({
            type: 'aoi-vector',
            id: `${inst.id}:${aoiRefKey(aoi)}`,
            metricId: inst.id,
            header: `${label}_${aoiRefText(aoi)}`,
            aoi,
          })
        }
      } else if (shape === 'aoi-pair-matrix') {
        const refs: WideAoiRef[] = [
          ...unionAoiNames.map(name => ({ kind: 'name', name }) as const),
          { kind: 'noAoi' },
        ]
        for (const fromAoi of refs) {
          for (const toAoi of refs) {
            rawColumns.push({
              type: 'aoi-pair-matrix',
              id: `${inst.id}:${aoiRefKey(fromAoi)}>${aoiRefKey(toAoi)}`,
              metricId: inst.id,
              header: `${label}_${aoiRefText(fromAoi)}_to_${aoiRefText(toAoi)}`,
              fromAoi,
              toAoi,
            })
          }
        }
      } else if (shape === 'participant-pair-matrix') {
        for (const pid of unionParticipantIds) {
          rawColumns.push({
            type: 'participant-pair',
            id: `${inst.id}:pair:${pid}`,
            metricId: inst.id,
            header: `${label}_${getParticipant(engine, pid).displayedName}`,
            otherParticipantId: pid,
          })
        }
      }
    }

    function sanitizeColumnName(name: string): string {
      return name.replace(/\s+/g, '_')
    }

    // Collision-proof header dedup: every suffixed candidate is re-checked
    // against ALL names already taken (including the fixed key columns), so a
    // base that itself ends in `_2` can never yield a duplicate header.
    const usedHeaders = new Set<string>(['Participant_ID', 'Participant', 'Stimulus'])
    const colIdToHeader = new Map<string, string>()
    for (const col of rawColumns) {
      const base = sanitizeColumnName(col.header)
      let candidate = base
      for (let n = 2; usedHeaders.has(candidate); n++) candidate = `${base}_${n}`
      usedHeaders.add(candidate)
      colIdToHeader.set(col.id, candidate)
    }

    const wideHeader = ['Participant_ID', 'Participant', 'Stimulus']
    for (const col of rawColumns) {
      wideHeader.push(colIdToHeader.get(col.id)!)
    }

    const relationalWideInstances = selectedInstances.filter(
      inst => projectionOutputShape(inst.projection) === 'participant-pair-matrix'
    )
    const perParticipantWideInstances = selectedInstances.filter(
      inst => projectionOutputShape(inst.projection) !== 'participant-pair-matrix'
    )

    let count = 0
    const total = options.stimulusIds.length * options.participantIds.length

    for (const stimulusId of options.stimulusIds) {
      const stimulus = getStimulus(engine, stimulusId)
      const stimulusName = stimulus.displayedName
      const participantIds = options.participantIds
      const aoiNames = getAois(engine, stimulusId).map(a => a.displayedName)
      const effectiveTimeEnd = timeEnd > 0 ? timeEnd : getStimulusHighestEndTime(engine, stimulusId)

      // Relational results are group-level: computed ONCE per stimulus, then
      // read per row. `indexByPid` avoids an indexOf per cell.
      const relationalResults = new Map<
        string,
        { matrix: number[]; size: number; indexByPid: Map<number, number> }
      >()
      if (relationalWideInstances.length > 0) {
        const groupScope: GroupScope = {
          engine,
          stimulusId,
          participantIds,
          timeStart,
          timeEnd: effectiveTimeEnd,
        }
        for (const inst of relationalWideInstances) {
          const result = queryGroup(inst, groupScope)
          if (result.shape !== 'participant-pair-matrix') continue
          if (result.provenance.aoiMissing) aoiMissingMap.set(inst.id, true)
          const indexByPid = new Map<number, number>()
          result.participantIds.forEach((pid, idx) => indexByPid.set(pid, idx))
          relationalResults.set(inst.id, {
            matrix: result.matrix,
            size: result.size,
            indexByPid,
          })
        }
      }

      // Per-stimulus slot resolution for the name-keyed union columns. An AOI
      // absent from this stimulus resolves to -1 and exports an empty cell
      // (not measured here), matching the long format's per-stimulus slots.
      const resolveVectorSlot = (
        aoi: WideAoiRef,
        slots: { noAoiSlot: number; anyFixationSlot: number }
      ): number => {
        if (aoi.kind === 'noAoi') return slots.noAoiSlot
        if (aoi.kind === 'anyFixation') return slots.anyFixationSlot
        return aoiNames.indexOf(aoi.name)
      }
      const resolveMatrixSlot = (aoi: WideAoiRef): number => {
        if (aoi.kind === 'noAoi') return aoiNames.length
        if (aoi.kind === 'anyFixation') return -1
        return aoiNames.indexOf(aoi.name)
      }

      for (const participantId of participantIds) {
        count++
        const participant = getParticipant(engine, participantId)
        const participantName = participant.displayedName

        if (onProgress) {
          await onProgress(count, total, `Computing metrics for ${participantName} · ${stimulusName}`)
          await new Promise(resolve => setTimeout(resolve, 0))
        }

        const participantEnd = getParticipantEndTime(engine, stimulusId, participantId)
        const scope: Scope = {
          engine,
          stimulusId,
          participantId,
          timeStart,
          timeEnd: Math.min(effectiveTimeEnd, participantEnd),
        }

        const batchResult = queryBatch(perParticipantWideInstances, scope)
        const rowValues = [participantId.toString(), participantName, stimulusName]

        for (const col of rawColumns) {
          if (col.type === 'participant-pair') {
            const rel = relationalResults.get(col.metricId)
            const idxA = rel?.indexByPid.get(participantId)
            const idxB = rel?.indexByPid.get(col.otherParticipantId)
            if (rel && idxA !== undefined && idxB !== undefined) {
              rowValues.push(
                formatNumberForCsv(rel.matrix[idxA * rel.size + idxB], decimalSeparator)
              )
            } else {
              rowValues.push('')
            }
            continue
          }

          const result = batchResult.get(col.metricId)
          if (!result) {
            rowValues.push('')
            continue
          }

          if (result.provenance.aoiMissing) {
            aoiMissingMap.set(col.metricId, true)
          }

          if (col.type === 'scalar' && result.shape === 'scalar') {
            rowValues.push(formatNumberForCsv(result.value, decimalSeparator))
          } else if (col.type === 'aoi-vector' && result.shape === 'aoi-vector') {
            const idx = resolveVectorSlot(col.aoi, result.slots)
            if (idx >= 0 && idx < result.values.length) {
              rowValues.push(formatNumberForCsv(result.values[idx], decimalSeparator))
            } else {
              rowValues.push('')
            }
          } else if (col.type === 'aoi-pair-matrix' && result.shape === 'aoi-pair-matrix') {
            const side = result.size
            const fromSlot = resolveMatrixSlot(col.fromAoi)
            const toSlot = resolveMatrixSlot(col.toAoi)
            const validFrom = fromSlot >= 0 && fromSlot < side
            const validTo = toSlot >= 0 && toSlot < side
            if (validFrom && validTo) {
              const val = result.matrix[fromSlot * side + toSlot]
              rowValues.push(formatNumberForCsv(val, decimalSeparator))
            } else {
              rowValues.push('')
            }
          } else {
            rowValues.push('')
          }
        }

        dataRows.push(rowValues)
      }
    }

    return buildResponse(generateCsvString(wideHeader, dataRows, options.csvOptions))
  }

  function buildResponse(dataContent: string) {
    let codebookContent: string | null = null
    if (includeCodebook) {
      const codebookHeader = [
        'Metric',
        'Base_Metric',
        'Base_Id',
        'Unit',
        'Measurement_Class',
        'Parameters',
        'Projection',
        'Window',
        'Output_Shape',
        'Time_Range',
        'Participants',
        'Stimuli',
        'AOI_Missing',
      ]

      const participantNames = options.participantIds
        .map(id => getParticipant(engine, id).displayedName)
        .join(', ')
      const stimuliNames = options.stimulusIds
        .map(id => getStimulus(engine, id).displayedName)
        .join(', ')

      const cbRows: string[][] = []

      for (const inst of selectedInstances) {
        const metric = getMetric(inst.baseId)
        const deDupLabel = resolvedLabels.get(inst.id) ?? inst.label
        const isAoiMissing = aoiMissingMap.get(inst.id) === true

        let windowStr = ''
        if (inst.projection.kind === 'windowed') {
          windowStr = windowLabel(inst.projection.window, metric?.meta.windowUnit ?? 'ms')
        }

        const maxEndStr = timeEnd > 0 ? `${timeEnd}` : 'max'
        const timeRangeStr =
          timeStart === 0 && timeEnd === 0 ? 'full' : `t ∈ [${timeStart}, ${maxEndStr}] ms`

        cbRows.push([
          deDupLabel,
          metric?.meta.label ?? '',
          inst.baseId,
          metric?.meta.unit ?? '',
          metric?.meta.measurementClass ?? '',
          formatParamReadout(inst).join(', '),
          formatProjectionReadout(inst) ?? '',
          windowStr,
          projectionOutputShape(inst.projection),
          timeRangeStr,
          participantNames,
          stimuliNames,
          isAoiMissing.toString(),
        ])
      }

      codebookContent = generateCsvString(codebookHeader, cbRows, options.csvOptions)
    }

    return {
      dataContent,
      codebookContent,
      rows: dataRows.length,
      metricCount: selectedInstances.length,
      stimulusCount: options.stimulusIds.length,
    }
  }
}
