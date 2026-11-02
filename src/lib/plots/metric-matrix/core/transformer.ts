import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  getStimuliInSelection,
  getParticipant,
  getParticipantsIds,
  getParticipantOrderVector,
  getNumberOfSegments,
  getNumberOfFixations,
} from '$lib/data/engine'
import { getMetric, query } from '$lib/metrics'
import { asShape, resolveMetric } from '$lib/plots/shared'
import { METRIC_MATRIX_CONTRACT } from '../const'
import type {
  CellState,
  MetricMatrixAxisEntry,
  MetricMatrixData,
  MetricMatrixPlotSettings,
} from '../types'

/**
 * Build the participant × stimulus metric grid — PURE `(engine, settings)`,
 * mirrors the metric-correlation transformer (id-keyed, one row per recording).
 *
 * The correctness-critical work is the per-cell classification: a cell's quality
 * verdict is computed metric-INDEPENDENTLY. `absent` and `no-fixations` are
 * decided from segment/fixation presence BEFORE the metric value is touched, so
 * a capture failure classifies identically under an extensive metric (which
 * would finalize to a finite 0 for a fixation-less scan) and an intensive one
 * (which returns NaN). Only a present, fixation-bearing recording ever reaches
 * `query()`, and there a benign unresolved reference (`refMissing` provenance,
 * an AOI or eye-movement type this dataset lacks) is kept
 * distinct from a genuine non-finite (`not-computable`). A finite 0 is a REAL
 * value, never NA.
 */
export function getMetricMatrixData(
  engine: DataEngine,
  settings: MetricMatrixPlotSettings
): MetricMatrixData {
  const meta = engine.metadata
  if (!meta) return { ...emptyData(), empty: 'no-rows' }

  const resolved = resolveMetric({
    engine,
    id: settings.metricInstanceIds?.[0] ?? null,
    contract: METRIC_MATRIX_CONTRACT,
  })
  if (!resolved.ok) return { ...emptyData(), noMetric: true }

  const instance = resolved.instance
  const metric = getMetric(instance.baseId)
  const unit = metric?.meta.unit ?? ''

  // Columns: the stimulus SELECTION's members (all stimuli when unset), in
  // display order.
  const stimuli = getStimuliInSelection(engine, settings.stimulusSelectionId)
  const cols: MetricMatrixAxisEntry[] = stimuli.map(s => ({
    id: s.id,
    label: s.displayedName,
  }))

  // Rows: one per participant id (no displayed-name merge), in the global
  // participant order rather than first appearance, so a row never moves with
  // the data. `hideEmptyParticipants` keeps those recorded on any shown stimulus.
  const eligible = new Set<number>()
  for (const s of stimuli) {
    for (const pid of getParticipantsIds(engine, settings, s.id)) eligible.add(pid)
  }
  const rowIds = getParticipantOrderVector(engine).filter(pid => eligible.has(pid))
  const rows = labelRows(engine, rowIds)

  const colCount = cols.length
  const rowCount = rows.length
  if (colCount === 0)
    return { ...emptyData(), cols, rows, unit, empty: 'no-cols' }
  if (rowCount === 0)
    return { ...emptyData(), cols, rows, unit, empty: 'no-rows' }

  const values = new Float64Array(rowCount * colCount)
  const state: CellState[] = new Array(rowCount * colCount)
  // -1 = absent (no recording); 0 = present but no fixations; ≥1 = fixation count.
  const fixations = new Int32Array(rowCount * colCount).fill(-1)
  let anyFinite = false

  for (let r = 0; r < rowCount; r++) {
    const pid = rows[r].id
    const base = r * colCount
    for (let c = 0; c < colCount; c++) {
      const sid = cols[c].id
      const i = base + c
      let st: CellState
      let v = Number.NaN

      if (getNumberOfSegments(engine, sid, pid) === 0) {
        st = 'absent' // no recording
      } else if ((fixations[i] = getNumberOfFixations(engine, sid, pid)) === 0) {
        st = 'no-fixations' // recording present, zero fixations → capture failure
      } else {
        const res = asShape(
          query(instance, {
            engine,
            stimulusId: sid,
            participantId: pid,
            timeStart: 0,
            timeEnd: 0,
          }),
          'scalar'
        )
        if (res?.provenance.refMissing) {
          st = 'aoi-not-present' // benign: the instance's AOI ref isn't on this stimulus
        } else if (!res || !res.isFinite) {
          st = 'not-computable' // present + fixations, yet non-finite
        } else {
          st = null // finite value (incl. a legitimate 0)
          v = res.value
          anyFinite = true
        }
      }

      values[i] = v
      state[i] = st
    }
  }

  return {
    rows,
    cols,
    values,
    state,
    fixations,
    unit,
    ...(anyFinite ? {} : { empty: 'all-na' as const }),
  }
}

/**
 * One label per recording id, disambiguating shared displayed names by
 * appending the original name (rows are id-keyed; the displayed name is only
 * the label).
 */
function labelRows(engine: DataEngine, ids: number[]): MetricMatrixAxisEntry[] {
  const nameCounts = new Map<string, number>()
  for (const id of ids) {
    const name = getParticipant(engine, id).displayedName
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }
  return ids.map(id => {
    const p = getParticipant(engine, id)
    const isDuplicate = (nameCounts.get(p.displayedName) ?? 0) > 1
    return {
      id,
      label: isDuplicate ? `${p.displayedName} (${p.originalName})` : p.displayedName,
    }
  })
}

function emptyData(): MetricMatrixData {
  return {
    rows: [],
    cols: [],
    values: new Float64Array(0),
    state: [],
    fixations: new Int32Array(0),
    unit: '',
  }
}
