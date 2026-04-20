import {
  getAllAois,
  getParticipant,
  getParticipantsIds,
  getStimulus,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import '$lib/metrics/init'
import { getMetricDef } from '$lib/metrics/registry'
import type { MetricComputeContext, MetricInstance } from '$lib/metrics/types'
import {
  escapeCsvField,
  formatNumberForCsv,
  type CsvFormatOptions,
} from '../encoders/csv'

type ComputeFn = (
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  aoiIndex: number,
  anyFixationSlot: number
) => number

function _inst(baseId: string): MetricInstance {
  return { id: 0, baseId, params: {}, label: '' }
}

function _ctx(stimulusId: number, participantId: number): MetricComputeContext {
  return { stimulusId, participantId, timeStart: 0, timeEnd: 0 }
}

function _nanToNeg(v: number): number {
  return Number.isNaN(v) ? -1 : v
}

export const AGGREGATED_METRIC_CONFIG: ReadonlyArray<{
  readonly key: string
  readonly label: string
  readonly sublabel: string
  readonly csvName: string
  readonly compute: ComputeFn
}> = [
  {
    key: 'absoluteDwellTime',
    label: 'Absolute Dwell Time',
    sublabel: 'Total time spent in each AOI (ms)',
    csvName: 'Absolute_Dwell_Time',
    compute: (engine, sId, pId, aoiIdx) =>
      getMetricDef('absoluteTime')?.compute(engine, _ctx(sId, pId), _inst('absoluteTime'))[aoiIdx] ?? -1,
  },
  {
    key: 'relativeDwellTime',
    label: 'Relative Dwell Time (%)',
    sublabel: 'Dwell time as percentage of total viewing time',
    csvName: 'Relative_Dwell_Time',
    compute: (engine, sId, pId, aoiIdx) =>
      getMetricDef('relativeTime')?.compute(engine, _ctx(sId, pId), _inst('relativeTime'))[aoiIdx] ?? 0,
  },
  {
    key: 'timeToFirstFixation',
    label: 'Time to First Fixation',
    sublabel: 'Time until first fixation on each AOI (-1 if never fixated)',
    csvName: 'Time_To_First_Fixation',
    compute: (engine, sId, pId, aoiIdx) =>
      _nanToNeg(getMetricDef('timeToFirstFixation')?.compute(engine, _ctx(sId, pId), _inst('timeToFirstFixation'))[aoiIdx] ?? NaN),
  },
  {
    key: 'firstFixationDuration',
    label: 'First Fixation Duration',
    sublabel: 'Duration of the first fixation on each AOI (-1 if never fixated)',
    csvName: 'First_Fixation_Duration',
    compute: (engine, sId, pId, aoiIdx) =>
      _nanToNeg(getMetricDef('avgFirstFixationDuration')?.compute(engine, _ctx(sId, pId), _inst('avgFirstFixationDuration'))[aoiIdx] ?? NaN),
  },
  {
    key: 'fixationCount',
    label: 'Fixation Count',
    sublabel: 'Number of fixations on each AOI',
    csvName: 'Fixation_Count',
    compute: (engine, sId, pId, aoiIdx) =>
      getMetricDef('averageFixationCount')?.compute(engine, _ctx(sId, pId), _inst('averageFixationCount'))[aoiIdx] ?? -1,
  },
  {
    key: 'meanFixationDuration',
    label: 'Mean Fixation Duration',
    sublabel: 'Average duration of fixations on each AOI',
    csvName: 'Mean_Fixation_Duration',
    compute: (engine, sId, pId, aoiIdx) =>
      _nanToNeg(getMetricDef('avgFixationDuration')?.compute(engine, _ctx(sId, pId), _inst('avgFixationDuration'))[aoiIdx] ?? NaN),
  },
  {
    key: 'visitCount',
    label: 'Visit Count',
    sublabel: 'Number of distinct visits to each AOI',
    csvName: 'Visit_Count',
    compute: (engine, sId, pId, aoiIdx) =>
      getMetricDef('averageEntries')?.compute(engine, _ctx(sId, pId), _inst('averageEntries'))[aoiIdx] ?? -1,
  },
  {
    key: 'meanVisitDuration',
    label: 'Mean Visit Duration',
    sublabel: 'Average duration of visits to each AOI',
    csvName: 'Mean_Visit_Duration',
    compute: (engine, sId, pId, aoiIdx) =>
      _nanToNeg(getMetricDef('avgDwellDuration')?.compute(engine, _ctx(sId, pId), _inst('avgDwellDuration'))[aoiIdx] ?? NaN),
  },
] as const

export type AggregatedMetricKey = (typeof AGGREGATED_METRIC_CONFIG)[number]['key']

export type AggregatedExportOptions = {
  fileName: string
  groupId: number
  stimulusIds: number[]
  metrics: AggregatedMetricKey[]
  csvOptions?: CsvFormatOptions
}

function getAoiName(aoiIndex: number, aois: Array<{ displayedName: string }>, totalSlots: number): string {
  if (aoiIndex < aois.length) return aois[aoiIndex].displayedName
  if (aoiIndex === aois.length) return 'No_AOI'
  if (aoiIndex === totalSlots - 1) return 'Any_Fixation'
  return `Slot_${aoiIndex}`
}

export function generateAggregatedCsv(
  engine: DataEngine,
  options: AggregatedExportOptions
): { content: string; rows: number; metricCount: number; stimulusCount: number } {
  const delimiter = options.csvOptions?.delimiter ?? ','
  const decimalSeparator = options.csvOptions?.decimalSeparator ?? '.'
  const activeMetrics = AGGREGATED_METRIC_CONFIG.filter(config =>
    options.metrics.includes(config.key as AggregatedMetricKey)
  )

  const csvRows = [
    [
      'Participant_ID',
      'Participant_Name',
      'Stimulus',
      'AOI_Group',
      'Metric',
      'Value',
    ]
      .map(value => escapeCsvField(value, delimiter))
      .join(delimiter),
  ]

  for (const stimulusId of options.stimulusIds) {
    const stimulus = getStimulus(engine, stimulusId)
    const participantIds = getParticipantsIds(engine, options.groupId, stimulusId)
    const aois = getAllAois(engine, stimulusId)
    const totalSlots = aois.length + 2
    const anyFixationSlot = totalSlots - 1

    for (const participantId of participantIds) {
      const participant = getParticipant(engine, participantId)

      for (const config of activeMetrics) {
        for (let aoiIndex = 0; aoiIndex < totalSlots; aoiIndex++) {
          const value = config.compute(engine, stimulusId, participantId, aoiIndex, anyFixationSlot)

          csvRows.push(
            [
              escapeCsvField(participantId.toString(), delimiter),
              escapeCsvField(participant.displayedName, delimiter),
              escapeCsvField(stimulus.displayedName, delimiter),
              escapeCsvField(getAoiName(aoiIndex, aois, totalSlots), delimiter),
              escapeCsvField(config.csvName, delimiter),
              escapeCsvField(formatNumberForCsv(value, decimalSeparator), delimiter),
            ].join(delimiter)
          )
        }
      }
    }
  }

  return {
    content: csvRows.join('\n'),
    rows: csvRows.length - 1,
    metricCount: activeMetrics.length,
    stimulusCount: options.stimulusIds.length,
  }
}
