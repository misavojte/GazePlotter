import type { DataType } from '$lib/data/types'
import type { ErrorRecord } from '$lib/errors'
import type { FileInputType, FileMetadataType } from '$lib/data/ingest'

type MetadataSource = Pick<DataType, 'aois' | 'participants' | 'stimuli'>

type BrowserPerformanceMemory = {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

export interface MetadataMemoryInfo {
  used: number
  total: number
  limit: number
  available: boolean
}

export interface MetadataAoiCount {
  stimulusName: string
  count: number
}

export interface MetadataOverview {
  numberOfStimuli: number
  numberOfParticipants: number
  hasSpatialData: boolean
  aoiCounts: {
    perStimulus: MetadataAoiCount[]
    total: number
  }
}

export interface MetadataCsvFormatters {
  formatDate: (value: string) => string
  formatDuration: (value: number) => string
  formatFileSize: (value: number) => string
}

export interface MetadataCsvReportInput {
  overview: MetadataOverview
  memoryInfo: MetadataMemoryInfo
  currentFileInput: FileInputType | null
  isSameAsSource: boolean
  fileMetadata: FileMetadataType | null
  recentErrors: ErrorRecord[]
  generatedAt: string
}

function createEmptyMetadataOverview(): MetadataOverview {
  return {
    numberOfStimuli: 0,
    numberOfParticipants: 0,
    hasSpatialData: false,
    aoiCounts: {
      perStimulus: [],
      total: 0,
    },
  }
}

function createEmptyMemoryInfo(): MetadataMemoryInfo {
  return {
    used: 0,
    total: 0,
    limit: 0,
    available: false,
  }
}

function areArraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function isBrowserPerformanceMemory(
  value: unknown
): value is BrowserPerformanceMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'usedJSHeapSize' in value &&
    typeof value.usedJSHeapSize === 'number' &&
    'totalJSHeapSize' in value &&
    typeof value.totalJSHeapSize === 'number' &&
    'jsHeapSizeLimit' in value &&
    typeof value.jsHeapSizeLimit === 'number'
  )
}

function csvCell(value: string): string {
  return JSON.stringify(value)
}

export function formatMetadataDate(isoString: string): string {
  return new Date(isoString).toLocaleString()
}

export function buildMetadataExportFileName(date: Date): string {
  return `GazePlotter_Metadata_${date.toISOString().split('T')[0]}.csv`
}

export function sumFileSizes(fileSizes: readonly number[]): number {
  return fileSizes.reduce((sum, size) => sum + size, 0)
}

export function isCurrentParsingSameAsSource(
  currentFileInput: FileInputType | null,
  fileMetadata: FileMetadataType | null
): boolean {
  if (currentFileInput === null || fileMetadata === null) {
    return false
  }

  return (
    currentFileInput.parseDate === fileMetadata.parseDate &&
    areArraysEqual(currentFileInput.fileNames, fileMetadata.fileNames) &&
    areArraysEqual(currentFileInput.fileSizes, fileMetadata.fileSizes)
  )
}

export function buildMetadataOverview(
  metadata: MetadataSource | null | undefined,
  hasSpatialData: boolean = false
): MetadataOverview {
  if (metadata === null || metadata === undefined) {
    return createEmptyMetadataOverview()
  }

  const perStimulus = metadata.stimuli.data.map((stimulus, index) => {
    return {
      stimulusName: stimulus[0] ?? '',
      count: metadata.aois.data[index]?.length ?? 0,
    }
  })

  return {
    numberOfStimuli: metadata.stimuli.data.length,
    numberOfParticipants: metadata.participants.data.length,
    hasSpatialData,
    aoiCounts: {
      perStimulus,
      total: perStimulus.reduce((sum, stimulus) => sum + stimulus.count, 0),
    },
  }
}

export function getMetadataMemoryInfo(
  performanceInfo: unknown
): MetadataMemoryInfo {
  if (
    typeof performanceInfo !== 'object' ||
    performanceInfo === null ||
    !('memory' in performanceInfo) ||
    !isBrowserPerformanceMemory(performanceInfo.memory)
  ) {
    return createEmptyMemoryInfo()
  }

  return {
    used: performanceInfo.memory.usedJSHeapSize,
    total: performanceInfo.memory.totalJSHeapSize,
    limit: performanceInfo.memory.jsHeapSizeLimit,
    available: true,
  }
}

export function formatMemoryUtilization(
  memoryInfo: Pick<MetadataMemoryInfo, 'available' | 'limit' | 'used'>
): string {
  if (!memoryInfo.available || memoryInfo.limit <= 0) {
    return '0.0% of limit'
  }

  return `${((memoryInfo.used / memoryInfo.limit) * 100).toFixed(1)}% of limit`
}

export function buildMetadataCsvReport(
  input: MetadataCsvReportInput,
  formatters: MetadataCsvFormatters
): string {
  const lines: string[] = []
  lines.push('GazePlotter Metadata Export')
  lines.push(`Generated,${input.generatedAt}`)
  lines.push('')

  lines.push('Section,Data Overview')
  lines.push('Metric,Value')
  lines.push(`Number of Stimuli,${input.overview.numberOfStimuli}`)
  lines.push(`Number of Participants,${input.overview.numberOfParticipants}`)
  lines.push(
    `Has Spatial Data,${input.overview.hasSpatialData ? 'Yes' : 'No'}`
  )
  lines.push(`Total Number of AOIs,${input.overview.aoiCounts.total}`)
  lines.push('')

  if (input.memoryInfo.available) {
    lines.push('Section,RAM Usage')
    lines.push('Metric,Value')
    lines.push(
      `Current JS Heap Size (used),${formatters.formatFileSize(input.memoryInfo.used)}`
    )
    lines.push(
      `Total JS Heap Size (allocated),${formatters.formatFileSize(input.memoryInfo.total)}`
    )
    lines.push(
      `JS Heap Size Limit (max available),${formatters.formatFileSize(input.memoryInfo.limit)}`
    )
    lines.push(
      `Memory utilization,${formatMemoryUtilization(input.memoryInfo)}`
    )
    lines.push('')
  }

  if (input.overview.aoiCounts.perStimulus.length > 0) {
    lines.push('Section,AOIs per Stimulus')
    lines.push('Stimulus Name,AOI Count')
    for (const stimulus of input.overview.aoiCounts.perStimulus) {
      lines.push(`${stimulus.stimulusName},${stimulus.count}`)
    }
    lines.push('')
  }

  if (input.currentFileInput !== null && !input.isSameAsSource) {
    lines.push('Section,Current Parsing')
    lines.push('Metric,Value')
    lines.push(
      `Files Being Processed,${input.currentFileInput.fileNames.length}`
    )
    lines.push(
      `Total File Size,${formatters.formatFileSize(sumFileSizes(input.currentFileInput.fileSizes))}`
    )
    lines.push(
      `Parse Date,${formatters.formatDate(input.currentFileInput.parseDate)}`
    )
    lines.push('')

    lines.push('Section,Current Parsing Files')
    lines.push('File Name,File Size (bytes)')
    for (let i = 0; i < input.currentFileInput.fileNames.length; i += 1) {
      lines.push(
        `${input.currentFileInput.fileNames[i]},${input.currentFileInput.fileSizes[i]}`
      )
    }
    lines.push('')
  }

  const sourceTotalFileSize =
    input.fileMetadata === null ? 0 : sumFileSizes(input.fileMetadata.fileSizes)

  if (input.fileMetadata === null) {
    lines.push('Section,Source Parsing')
    lines.push(
      'Note,This data was parsed before GazePlotter version 1.7.0 and original parsing metadata is not available.'
    )
    lines.push('')
  } else if (input.fileMetadata.status === 'failure') {
    lines.push('Section,Source Parsing - FAILED')
    lines.push('Metric,Value')
    lines.push('Status,FAILURE')
    lines.push(`Error ID,${input.fileMetadata.errorId}`)
    lines.push(
      `Error Timestamp,${formatters.formatDate(input.fileMetadata.errorCreatedAt)}`
    )
    lines.push(`User Message,${csvCell(input.fileMetadata.userMessage)}`)
    if (input.fileMetadata.debugMessage !== input.fileMetadata.userMessage) {
      lines.push(`Debug Message,${csvCell(input.fileMetadata.debugMessage)}`)
    }
    lines.push(`Files Attempted,${input.fileMetadata.fileNames.length}`)
    lines.push(
      `Total File Size,${formatters.formatFileSize(sourceTotalFileSize)}`
    )
    if (input.fileMetadata.attemptedParseDuration !== undefined) {
      lines.push(
        `Attempted Parse Duration,${formatters.formatDuration(input.fileMetadata.attemptedParseDuration)}`
      )
    }
    lines.push(
      `Failure Date,${formatters.formatDate(input.fileMetadata.parseDate)}`
    )
    lines.push(`GazePlotter Version,${input.fileMetadata.gazePlotterVersion}`)
    lines.push(`Client,${csvCell(input.fileMetadata.clientUserAgent)}`)
    lines.push('')

    lines.push('Section,Attempted Files')
    lines.push('File Name,File Size (bytes)')
    for (let i = 0; i < input.fileMetadata.fileNames.length; i += 1) {
      lines.push(
        `${input.fileMetadata.fileNames[i]},${input.fileMetadata.fileSizes[i]}`
      )
    }
    lines.push('')

    if (input.fileMetadata.stack) {
      lines.push('Section,Error Stack Trace')
      lines.push(csvCell(input.fileMetadata.stack))
      lines.push('')
    }
  } else {
    lines.push('Section,Source Parsing')
    lines.push('Metric,Value')
    lines.push('Status,SUCCESS')
    lines.push(`Files Processed,${input.fileMetadata.fileNames.length}`)
    lines.push(
      `Total File Size,${formatters.formatFileSize(sourceTotalFileSize)}`
    )
    lines.push(
      `Parse Duration,${formatters.formatDuration(input.fileMetadata.parseDuration)}`
    )
    lines.push(
      `Parse Date,${formatters.formatDate(input.fileMetadata.parseDate)}`
    )
    lines.push(`GazePlotter Version,${input.fileMetadata.gazePlotterVersion}`)
    lines.push(`Client,${csvCell(input.fileMetadata.clientUserAgent)}`)
    lines.push('')

    lines.push('Section,Source Parsing Files')
    lines.push('File Name,File Size (bytes)')
    for (let i = 0; i < input.fileMetadata.fileNames.length; i += 1) {
      lines.push(
        `${input.fileMetadata.fileNames[i]},${input.fileMetadata.fileSizes[i]}`
      )
    }
    lines.push('')

    lines.push('Section,Parse Settings')
    lines.push('Setting,Value')
    lines.push(`Type,${input.fileMetadata.parseSettings.type}`)
    lines.push(
      `Row Delimiter,"${JSON.stringify(input.fileMetadata.parseSettings.rowDelimiter)}"`
    )
    lines.push(
      `Column Delimiter,"${JSON.stringify(input.fileMetadata.parseSettings.columnDelimiter)}"`
    )
    if ('userInputSetting' in input.fileMetadata.parseSettings) {
      lines.push(
        `User Input Setting,${input.fileMetadata.parseSettings.userInputSetting || '(empty)'}`
      )
    }
  }

  if (input.recentErrors.length > 0) {
    lines.push('Section,Recent Errors')
    lines.push('Timestamp,Origin,Severity,User Message,Debug Message,Context')
    for (const error of input.recentErrors) {
      lines.push(
        [
          csvCell(error.createdAt),
          csvCell(error.origin),
          csvCell(error.severity),
          csvCell(error.userMessage),
          csvCell(error.debugMessage),
          csvCell(JSON.stringify(error.context ?? null)),
        ].join(',')
      )
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}
