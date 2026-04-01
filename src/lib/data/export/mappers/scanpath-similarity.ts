import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { SimilarityMethod } from '$lib/plots/scanpath-similarity/types'
import { getScanpathSimilarityData } from '$lib/plots/scanpath-similarity/core/transformer'
import {
  formatNumberForCsv,
  generateCsvString,
  type CsvFormatOptions,
} from '../encoders/csv'

export type ScanpathSimilarityExportOptions = {
  fileName: string
  stimulusId: number
  groupId: number
  similarityMethod: SimilarityMethod
  collapsed: boolean
  csvOptions?: CsvFormatOptions
}

function buildParticipantLabel(label: string, participantId: number) {
  const trimmed = label.trim()
  return trimmed.length > 0 ? trimmed : `P${participantId}`
}

function buildColumnHeader(label: string, participantId: number) {
  const baseLabel = buildParticipantLabel(label, participantId)
  return `${baseLabel} (ID ${participantId})`
}

export function generateScanpathSimilarityCsv(
  engine: DataEngine,
  options: ScanpathSimilarityExportOptions
): { content: string; participantCount: number } {
  const { labels, participantIds, matrix, size } = getScanpathSimilarityData(
    engine,
    options.stimulusId,
    options.groupId,
    options.similarityMethod,
    options.collapsed
  )

  const decimalSeparator = options.csvOptions?.decimalSeparator ?? '.'
  const columnHeaders = labels.map((label, index) =>
    buildColumnHeader(label, participantIds[index])
  )

  const header = ['Participant_ID', 'Participant_Label', ...columnHeaders]
  const rows: string[][] = []

  for (let i = 0; i < size; i++) {
    const row: string[] = [
      participantIds[i]?.toString() ?? '',
      buildParticipantLabel(labels[i] ?? '', participantIds[i] ?? i),
    ]

    for (let j = 0; j < size; j++) {
      const value = matrix[i * size + j]
      row.push(formatNumberForCsv(value, decimalSeparator))
    }

    rows.push(row)
  }

  return {
    content: generateCsvString(header, rows, options.csvOptions),
    participantCount: size,
  }
}
