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
  type MetricResult,
  type AoiSlotInfo,
  type Scope,
  type GroupScope,
  formatProjectionReadout,
  instanceReadout,
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

/**
 * The identity of one AOI column/row slot: a real (displayed-named) AOI, or one
 * of the two synthetic slots. Synthetic slots are typed, never name strings, so
 * a real AOI displayed-named "No_AOI" stays distinct from the synthetic one.
 */
type SlotRef =
  | { kind: 'name'; name: string }
  | { kind: 'noAoi' }
  | { kind: 'anyFixation' }

/** Human-readable slot label (long-format AOI cell, wide-format column stem). */
function slotText(ref: SlotRef): string {
  return ref.kind === 'name' ? ref.name : ref.kind === 'noAoi' ? 'No_AOI' : 'Any_Fixation'
}

/** Stable key identifying a slot across the long walk and the wide columns. */
function slotKey(ref: SlotRef): string {
  return ref.kind === 'name' ? `name:${ref.name}` : ref.kind
}

/**
 * Wide-format column id for a per-participant cell coordinate. The column
 * builder and the per-row scatter both derive ids through here, so a cell
 * always lands in the column reserved for its coordinate (or nowhere → empty).
 */
function wideColId(
  metricId: string,
  coord: { aoi?: SlotRef; fromAoi?: SlotRef; toAoi?: SlotRef }
): string {
  if (coord.fromAoi && coord.toAoi) {
    return `${metricId}:${slotKey(coord.fromAoi)}>${slotKey(coord.toAoi)}`
  }
  if (coord.aoi) return `${metricId}:${slotKey(coord.aoi)}`
  return metricId
}

/** An aoi-vector slot index → its ref (per-stimulus slot semantics). */
function vectorSlotRef(slotIndex: number, slots: AoiSlotInfo, aoiNames: readonly string[]): SlotRef {
  if (slotIndex === slots.noAoiSlot) return { kind: 'noAoi' }
  if (slotIndex === slots.anyFixationSlot) return { kind: 'anyFixation' }
  return { kind: 'name', name: aoiNames[slotIndex] ?? `Slot_${slotIndex}` }
}

/** A matrix slot index → its ref (matrices carry No_AOI but never Any_Fixation). */
function matrixSlotRef(slotIndex: number, aoiNames: readonly string[]): SlotRef {
  if (slotIndex === aoiNames.length) return { kind: 'noAoi' }
  return { kind: 'name', name: aoiNames[slotIndex] ?? `Slot_${slotIndex}` }
}

/** Windowed projections carry a window size; everything else is unwindowed. */
function windowSizeOf(inst: MetricInstance): number {
  return inst.projection.kind === 'windowed' ? inst.projection.window.windowSize : 0
}

/**
 * One flattened output cell of a per-participant metric result: a value plus
 * whichever coordinates its shape carries (window, AOI slot, matrix pair). This
 * is the SINGLE place that knows how each of the five per-participant shapes
 * unrolls into cells — both the long and wide writers consume it, so a new
 * shape is handled once. The group-level `participant-pair-matrix` diverges
 * between the two formats (upper-triangle pairs vs. full grid) and is walked
 * separately by each; a relational cell reuses this type only for its value +
 * `participantB` label.
 */
interface ExportCell {
  window?: { start: number; end: number }
  aoi?: SlotRef
  fromAoi?: SlotRef
  toAoi?: SlotRef
  participantB?: string
  value: number
}

function* resultCells(
  result: MetricResult,
  windowSize: number,
  aoiNames: readonly string[]
): Generator<ExportCell> {
  switch (result.shape) {
    case 'scalar':
      yield { value: result.value }
      return
    case 'aoi-vector':
      for (let s = 0; s < result.slots.totalSlots; s++) {
        yield { aoi: vectorSlotRef(s, result.slots, aoiNames), value: result.values[s] }
      }
      return
    case 'aoi-pair-matrix': {
      const side = result.size
      for (let from = 0; from < side; from++) {
        for (let to = 0; to < side; to++) {
          yield {
            fromAoi: matrixSlotRef(from, aoiNames),
            toAoi: matrixSlotRef(to, aoiNames),
            value: result.matrix[from * side + to],
          }
        }
      }
      return
    }
    case 'scalar-timeseries':
      for (let w = 0; w < result.timeline.length; w++) {
        const start = result.timeline[w]
        yield { window: { start, end: start + windowSize }, value: result.values[w] }
      }
      return
    case 'aoi-vector-timeseries':
      for (let w = 0; w < result.timeline.length; w++) {
        const start = result.timeline[w]
        const vector = result.vectors[w] ?? []
        for (let s = 0; s < result.slots.totalSlots; s++) {
          yield {
            window: { start, end: start + windowSize },
            aoi: vectorSlotRef(s, result.slots, aoiNames),
            value: vector[s],
          }
        }
      }
      return
  }
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
    const cols = longFormatMetricColumns(selectedInstances)
    const { header } = cols

    const relationalInstances = selectedInstances.filter(
      inst => projectionOutputShape(inst.projection) === 'participant-pair-matrix'
    )
    const plainAndWindowedInstances = selectedInstances.filter(
      inst => projectionOutputShape(inst.projection) !== 'participant-pair-matrix'
    )

    // One row builder for every shape: the fixed key columns, then only the
    // coordinate columns this export reserves, then the metric/unit/value tail.
    const pushRow = (
      participantId: number,
      participantName: string,
      stimulusName: string,
      label: string,
      unit: string,
      cell: ExportCell
    ) => {
      const row = [participantId.toString(), participantName, stimulusName]
      if (cols.needWindow) {
        row.push(
          cell.window ? cell.window.start.toString() : '',
          cell.window ? cell.window.end.toString() : ''
        )
      }
      if (cols.needAoi) row.push(cell.aoi ? slotText(cell.aoi) : '')
      if (cols.needMatrix) {
        row.push(cell.fromAoi ? slotText(cell.fromAoi) : '', cell.toAoi ? slotText(cell.toAoi) : '')
      }
      if (cols.needParticipantB) row.push(cell.participantB ?? '')
      row.push(label, unit, formatNumberForCsv(cell.value, decimalSeparator))
      dataRows.push(row)
    }

    let count = 0
    const total = options.stimulusIds.length * options.participantIds.length

    for (const stimulusId of options.stimulusIds) {
      const stimulusName = getStimulus(engine, stimulusId).displayedName
      const participantIds = options.participantIds
      const aoiNames = getAois(engine, stimulusId).map(a => a.displayedName)
      const effectiveTimeEnd = timeEnd > 0 ? timeEnd : getStimulusHighestEndTime(engine, stimulusId)

      // Per-participant metrics: each result flattens to cells via resultCells.
      for (const participantId of participantIds) {
        count++
        const participantName = getParticipant(engine, participantId).displayedName

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
          if (result.provenance.aoiMissing) aoiMissingMap.set(inst.id, true)

          const label = resolvedLabels.get(inst.id) ?? inst.label
          for (const cell of resultCells(result, windowSizeOf(inst), aoiNames)) {
            pushRow(participantId, participantName, stimulusName, label, result.unit, cell)
          }
        }
      }

      // Relational metrics are group-level: the upper triangle of the
      // participant×participant matrix, one row per unordered pair.
      if (relationalInstances.length > 0) {
        const groupScope: GroupScope = { engine, stimulusId, participantIds, timeStart, timeEnd: effectiveTimeEnd }
        for (const inst of relationalInstances) {
          const result = queryGroup(inst, groupScope)
          if (result.shape !== 'participant-pair-matrix') continue
          if (result.provenance.aoiMissing) aoiMissingMap.set(inst.id, true)

          const label = resolvedLabels.get(inst.id) ?? inst.label
          const size = result.size
          const names = result.participantIds.map(id => getParticipant(engine, id).displayedName)

          for (let i = 0; i < size; i++) {
            for (let j = i + 1; j < size; j++) {
              pushRow(result.participantIds[i], names[i], stimulusName, label, result.unit, {
                participantB: names[j],
                value: result.matrix[i * size + j],
              })
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
    type WideColumn =
      | { type: 'scalar'; id: string; metricId: string; header: string }
      | { type: 'aoi-vector'; id: string; metricId: string; header: string; aoi: SlotRef }
      | {
          type: 'aoi-pair-matrix'
          id: string
          metricId: string
          header: string
          fromAoi: SlotRef
          toAoi: SlotRef
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

    const rawColumns: WideColumn[] = []

    for (const inst of selectedInstances) {
      const label = resolvedLabels.get(inst.id) ?? inst.label
      const shape = projectionOutputShape(inst.projection)

      if (shape === 'scalar') {
        rawColumns.push({ type: 'scalar', id: inst.id, metricId: inst.id, header: label })
      } else if (shape === 'aoi-vector') {
        const refs: SlotRef[] = [
          ...unionAoiNames.map(name => ({ kind: 'name', name }) as const),
          { kind: 'noAoi' },
          { kind: 'anyFixation' },
        ]
        for (const aoi of refs) {
          rawColumns.push({
            type: 'aoi-vector',
            id: wideColId(inst.id, { aoi }),
            metricId: inst.id,
            header: `${label}_${slotText(aoi)}`,
            aoi,
          })
        }
      } else if (shape === 'aoi-pair-matrix') {
        const refs: SlotRef[] = [
          ...unionAoiNames.map(name => ({ kind: 'name', name }) as const),
          { kind: 'noAoi' },
        ]
        for (const fromAoi of refs) {
          for (const toAoi of refs) {
            rawColumns.push({
              type: 'aoi-pair-matrix',
              id: wideColId(inst.id, { fromAoi, toAoi }),
              metricId: inst.id,
              header: `${label}_${slotText(fromAoi)}_to_${slotText(toAoi)}`,
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

      for (const participantId of participantIds) {
        count++
        const participantName = getParticipant(engine, participantId).displayedName

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

        // Scatter each per-participant result's cells into their column by id.
        // A union column with no matching cell this stimulus (AOI absent here)
        // stays empty. Wide forbids windowing, so no result carries a window.
        const batchResult = queryBatch(perParticipantWideInstances, scope)
        const cellByCol = new Map<string, number>()
        for (const inst of perParticipantWideInstances) {
          const result = batchResult.get(inst.id)
          if (!result) continue
          if (result.provenance.aoiMissing) aoiMissingMap.set(inst.id, true)
          for (const cell of resultCells(result, 0, aoiNames)) {
            cellByCol.set(wideColId(inst.id, cell), cell.value)
          }
        }

        const rowValues = [participantId.toString(), participantName, stimulusName]
        for (const col of rawColumns) {
          if (col.type === 'participant-pair') {
            const rel = relationalResults.get(col.metricId)
            const idxA = rel?.indexByPid.get(participantId)
            const idxB = rel?.indexByPid.get(col.otherParticipantId)
            rowValues.push(
              rel && idxA !== undefined && idxB !== undefined
                ? formatNumberForCsv(rel.matrix[idxA * rel.size + idxB], decimalSeparator)
                : ''
            )
            continue
          }
          const value = cellByCol.get(col.id)
          rowValues.push(value === undefined ? '' : formatNumberForCsv(value, decimalSeparator))
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
          // Full self-documenting readout (params + summary statistic +
          // cross-participant reduction) — formatParamReadout alone now hides
          // the `statistic`, so median/max/min would be indistinguishable from
          // the mean default in the codebook.
          instanceReadout(inst).join(', '),
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
