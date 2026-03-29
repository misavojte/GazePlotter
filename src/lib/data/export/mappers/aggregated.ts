import {
  getAllAois,
  getParticipant,
  getParticipantsIds,
  getStimulus,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { collectParticipantBarMetrics } from '$lib/plots/bar/core/collector'
import type { ParticipantBarMetrics } from '$lib/plots/bar/types'
import {
  escapeCsvField,
  formatNumberForCsv,
  type CsvFormatOptions,
} from '../encoders/csv'

export const AGGREGATED_METRIC_CONFIG = [
  {
    key: 'absoluteDwellTime',
    label: 'Absolute Dwell Time',
    sublabel: 'Total time spent in each AOI (ms)',
    csvName: 'Absolute_Dwell_Time',
    metricKey: 'dwellTime',
  },
  {
    key: 'relativeDwellTime',
    label: 'Relative Dwell Time (%)',
    sublabel: 'Dwell time as percentage of total viewing time',
    csvName: 'Relative_Dwell_Time',
    metricKey: 'dwellTime',
    processFunction: (
      _values: number[] | number,
      participantData?: ParticipantBarMetrics,
      aoiIndex?: number
    ) => {
      if (!participantData || aoiIndex === undefined) return 0
      const dwellTime = participantData.dwellTime[aoiIndex]
      const totalTime =
        participantData.dwellTime[participantData.dwellTime.length - 1]
      return totalTime > 0 ? (dwellTime / totalTime) * 100 : 0
    },
  },
  {
    key: 'timeToFirstFixation',
    label: 'Time to First Fixation',
    sublabel: 'Time until first fixation on each AOI (-1 if never fixated)',
    csvName: 'Time_To_First_Fixation',
    metricKey: 'ttff',
  },
  {
    key: 'firstFixationDuration',
    label: 'First Fixation Duration',
    sublabel:
      'Duration of the first fixation on each AOI (-1 if never fixated)',
    csvName: 'First_Fixation_Duration',
    metricKey: 'firstFixationDuration',
  },
  {
    key: 'fixationCount',
    label: 'Fixation Count',
    sublabel: 'Number of fixations on each AOI',
    csvName: 'Fixation_Count',
    metricKey: 'fixationCount',
  },
  {
    key: 'meanFixationDuration',
    label: 'Mean Fixation Duration',
    sublabel: 'Average duration of fixations on each AOI',
    csvName: 'Mean_Fixation_Duration',
    metricKey: 'avgFixationDuration',
    processFunction: (values: number[] | number) =>
      !Array.isArray(values) || values.length === 0
        ? -1
        : values.reduce((sum, value) => sum + value, 0) / values.length,
  },
  {
    key: 'visitCount',
    label: 'Visit Count',
    sublabel: 'Number of distinct visits to each AOI',
    csvName: 'Visit_Count',
    metricKey: 'entryCount',
  },
  {
    key: 'meanVisitDuration',
    label: 'Mean Visit Duration',
    sublabel: 'Average duration of visits to each AOI',
    csvName: 'Mean_Visit_Duration',
    metricKey: 'dwellDurations',
    processFunction: (values: number[] | number) =>
      !Array.isArray(values) || values.length === 0
        ? -1
        : values.reduce((sum, value) => sum + value, 0) / values.length,
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

function getAoiName(aoiIndex: number, aois: Array<{ displayedName: string }>): string {
  if (aoiIndex < aois.length) return aois[aoiIndex].displayedName
  if (aoiIndex === aois.length) return 'No_AOI'
  return 'Any_Fixation'
}

export function generateAggregatedCsv(
  engine: DataEngine,
  options: AggregatedExportOptions
): { content: string; rows: number; metricCount: number; stimulusCount: number } {
  const delimiter = options.csvOptions?.delimiter ?? ','
  const decimalSeparator = options.csvOptions?.decimalSeparator ?? '.'
  const activeMetrics = AGGREGATED_METRIC_CONFIG.filter(config =>
    options.metrics.includes(config.key)
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
    const participantMetrics = collectParticipantBarMetrics(
      engine,
      stimulusId,
      participantIds,
      aois
    )

    for (let participantIndex = 0; participantIndex < participantIds.length; participantIndex++) {
      const participantId = participantIds[participantIndex]
      const participant = getParticipant(engine, participantId)
      const participantFullMetrics = participantMetrics[participantIndex]

      for (const config of activeMetrics) {
        const metricDataArray = participantFullMetrics[config.metricKey]

        for (let aoiIndex = 0; aoiIndex < metricDataArray.length; aoiIndex++) {
          const rawValue = metricDataArray[aoiIndex]
          const value =
            'processFunction' in config
              ? config.processFunction(
                  rawValue as number[] | number,
                  participantFullMetrics,
                  aoiIndex
                )
              : (rawValue as number)

          csvRows.push(
            [
              escapeCsvField(participantId.toString(), delimiter),
              escapeCsvField(participant.displayedName, delimiter),
              escapeCsvField(stimulus.displayedName, delimiter),
              escapeCsvField(getAoiName(aoiIndex, aois), delimiter),
              escapeCsvField(config.csvName, delimiter),
              escapeCsvField(
                formatNumberForCsv(value, decimalSeparator),
                delimiter
              ),
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
