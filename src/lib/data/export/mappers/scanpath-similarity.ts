import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getAois, getParticipantsIds } from '$lib/data/engine'
import {
  collectAllScanpaths,
  computeSimilarityMatrix,
  type SimilarityMethod,
} from '$lib/metrics'
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
  const meta = engine.metadata
  const participantIds = getParticipantsIds(engine, options.groupId, options.stimulusId)
  const aois = meta?.aois.data[options.stimulusId] ? getAois(engine, options.stimulusId) : []
  const entries = collectAllScanpaths(
    engine,
    options.stimulusId,
    participantIds,
    aois,
    options.collapsed,
  )
  const labels = entries.map(e => e.label)
  const resolvedIds = entries.map(e => e.participantId)
  const matrix = computeSimilarityMatrix(entries.map(e => e.scanpath), options.similarityMethod)
  const size = entries.length

  const decimalSeparator = options.csvOptions?.decimalSeparator ?? '.'
  const columnHeaders = labels.map((label, index) =>
    buildColumnHeader(label, resolvedIds[index])
  )

  const header = ['Participant_ID', 'Participant_Label', ...columnHeaders]
  const rows: string[][] = []

  for (let i = 0; i < size; i++) {
    const row: string[] = [
      resolvedIds[i]?.toString() ?? '',
      buildParticipantLabel(labels[i] ?? '', resolvedIds[i] ?? i),
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
