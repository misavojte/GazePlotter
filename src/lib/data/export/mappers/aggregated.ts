import {
  getAllAois,
  getParticipant,
  getParticipantsIds,
  getStimulus,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { query, type MetricInstance, type Scope } from '$lib/metrics'
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

function _computeAtSlot(baseId: string): ComputeFn {
  const inst: MetricInstance = {
    id: '', baseId, params: {}, label: '',
    projection: { kind: 'identity-aoi-vector' },
  }
  return (engine, stimulusId, participantId, aoiIdx) => {
    const scope: Scope = { engine, stimulusId, participantId, timeStart: 0, timeEnd: 0 }
    const result = query(inst, scope)
    if (result.shape === 'aoi-vector') return result.values[aoiIdx] ?? Number.NaN
    if (result.shape === 'scalar') return result.value
    if (result.shape === 'aoi-pair-matrix') return result.matrix[aoiIdx] ?? Number.NaN
    return Number.NaN
  }
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
    compute: (engine, sId, pId, aoiIdx) => {
      const v = _computeAtSlot('absoluteTime')(engine, sId, pId, aoiIdx, 0)
      return Number.isFinite(v) ? v : -1
    },
  },
  {
    key: 'relativeDwellTime',
    label: 'Relative Dwell Time (%)',
    sublabel: 'Dwell time as percentage of total viewing time',
    csvName: 'Relative_Dwell_Time',
    compute: (engine, sId, pId, aoiIdx) => {
      const v = _computeAtSlot('relativeTime')(engine, sId, pId, aoiIdx, 0)
      return Number.isFinite(v) ? v : 0
    },
  },
  {
    key: 'timeToFirstFixation',
    label: 'Time to First Fixation',
    sublabel: 'Time until first fixation on each AOI (-1 if never fixated)',
    csvName: 'Time_To_First_Fixation',
    compute: (engine, sId, pId, aoiIdx) =>
      _nanToNeg(_computeAtSlot('timeToFirstFixation')(engine, sId, pId, aoiIdx, 0)),
  },
  {
    key: 'firstFixationDuration',
    label: 'First Fixation Duration',
    sublabel: 'Duration of the first fixation on each AOI (-1 if never fixated)',
    csvName: 'First_Fixation_Duration',
    compute: (engine, sId, pId, aoiIdx) =>
      _nanToNeg(_computeAtSlot('firstFixationDuration')(engine, sId, pId, aoiIdx, 0)),
  },
  {
    key: 'fixationCount',
    label: 'Fixation Count',
    sublabel: 'Number of fixations on each AOI',
    csvName: 'Fixation_Count',
    compute: (engine, sId, pId, aoiIdx) => {
      const v = _computeAtSlot('fixationCount')(engine, sId, pId, aoiIdx, 0)
      return Number.isFinite(v) ? v : -1
    },
  },
  {
    key: 'meanFixationDuration',
    label: 'Mean Fixation Duration',
    sublabel: 'Average duration of fixations on each AOI',
    csvName: 'Mean_Fixation_Duration',
    compute: (engine, sId, pId, aoiIdx) =>
      _nanToNeg(_computeAtSlot('fixationDuration')(engine, sId, pId, aoiIdx, 0)),
  },
  {
    key: 'visitCount',
    label: 'Visit Count',
    sublabel: 'Number of distinct visits to each AOI',
    csvName: 'Visit_Count',
    compute: (engine, sId, pId, aoiIdx) => {
      const v = _computeAtSlot('visitCount')(engine, sId, pId, aoiIdx, 0)
      return Number.isFinite(v) ? v : -1
    },
  },
  {
    key: 'meanVisitDuration',
    label: 'Mean Visit Duration',
    sublabel: 'Average duration of visits to each AOI',
    csvName: 'Mean_Visit_Duration',
    compute: (engine, sId, pId, aoiIdx) =>
      _nanToNeg(_computeAtSlot('visitDuration')(engine, sId, pId, aoiIdx, 0)),
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
