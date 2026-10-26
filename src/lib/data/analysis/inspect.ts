/**
 * What a loaded dataset contains, as plain JSON: the names a caller needs
 * to choose stimuli, participants, selections, and metric instances, and
 * the recording spans the metrics will range over.
 */
import type { DataEngine } from '../engine/dataEngine.svelte'
import {
  getAllCategories,
  getAllParticipants,
  getAois,
  getEventChannels,
  getNumberOfFixations,
  getParticipantEndTime,
  getStimuli,
} from '../engine/selectors'
import type { DataCapabilities } from '../types'
import { getMetric, listMetrics } from '$lib/metrics/core/defineMetric'
import { projectionOutputShape } from '$lib/metrics/core/projection'
import type { OutputShape } from '$lib/metrics/core/dsl'
import type { MetricInstance } from '$lib/metrics/instances'
import { GAZEPLOTTER_VERSION } from '$lib/version'
import { exportAnalysis, type Analysis } from './analysis'

export interface Inspection {
  gazeplotter: string
  capabilities: DataCapabilities
  participants: string[]
  stimuli: {
    name: string
    aois: string[]
    events: string[]
    /** Participants with at least one fixation on this stimulus. */
    recorded: string[]
    /** Latest recording end on this stimulus, in ms. */
    endMs: number
  }[]
  categories: string[]
  selections: Analysis['selections']
  /** The dataset's metric library: what `exportMetrics` can be asked for. */
  metrics: {
    id: string
    label: string
    baseId: string
    shape: OutputShape
    unit: string
    params: Record<string, unknown>
    projection: MetricInstance['projection']
  }[]
}

export function inspect(engine: DataEngine): Inspection {
  const data = engine.toDataType()
  if (!data) throw new Error('No dataset loaded')
  const participants = getAllParticipants(engine)
  return {
    gazeplotter: GAZEPLOTTER_VERSION,
    capabilities: engine.capabilities,
    participants: participants.map(p => p.displayedName),
    stimuli: getStimuli(engine).map(s => ({
      name: s.displayedName,
      aois: getAois(engine, s.id).map(a => a.displayedName),
      events: getEventChannels(engine, s.id).map(c => c.displayedName),
      recorded: participants
        .filter(p => getNumberOfFixations(engine, s.id, p.id) > 0)
        .map(p => p.displayedName),
      endMs: Math.max(0, ...participants.map(p => getParticipantEndTime(engine, s.id, p.id))),
    })),
    categories: getAllCategories(engine).map(c => c.displayedName),
    selections: exportAnalysis(data).selections,
    metrics: data.metricInstances.map(inst => ({
      id: inst.id,
      label: inst.label,
      baseId: inst.baseId,
      shape: projectionOutputShape(inst.projection),
      unit: getMetric(inst.baseId)?.meta.unit ?? '',
      params: inst.params,
      projection: inst.projection,
    })),
  }
}

/** The metric library itself: every base metric an instance can be built on. */
export function metricCatalog() {
  return listMetrics().map(({ meta }) => ({
    id: meta.id,
    label: meta.label,
    unit: meta.unit,
    category: meta.category,
    rawShape: meta.rawShape,
    measurementClass: meta.measurementClass,
    description: meta.description,
    params: meta.params.map(p => ({ id: p.id, label: p.label })),
  }))
}
