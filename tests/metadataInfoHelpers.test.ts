import { describe, expect, it } from 'vitest'
import type { ErrorRecord } from '$lib/errors'
import {
  buildMetadataCsvReport,
  buildMetadataExportFileName,
  buildMetadataOverview,
  formatMemoryUtilization,
  getMetadataMemoryInfo,
  isCurrentParsingSameAsSource,
} from '$lib/modals/info/metadata-info/helpers'
import type { ParseSettings } from '$lib/data/ingest'
import type {
  FileInputType,
  FileMetadataFailureType,
  FileMetadataSuccessType,
} from '$lib/data/ingest'
import { createMockMetadata } from './helpers/workspaceCommandFixtures'

const csvFormatters = {
  formatDate: (value: string) => `DATE(${value})`,
  formatDuration: (value: number) => `DURATION(${value})`,
  formatFileSize: (value: number) => `SIZE(${value})`,
}

function createParseSettings(
  overrides: Partial<ParseSettings> = {}
): ParseSettings {
  return {
    rowDelimiter: '\n',
    columnDelimiter: ',',
    encoding: 'utf-8',
    type: 'csv',
    userInputSetting: 'manual',
    headerRowId: 0,
    ...overrides,
  }
}

function createRecentError(overrides: Partial<ErrorRecord> = {}): ErrorRecord {
  return {
    id: 1,
    createdAt: '2026-03-14T12:00:00.000Z',
    origin: 'modal',
    severity: 'recoverable',
    userMessage: 'Visible message',
    debugMessage: 'Debug message',
    context: { section: 'metadata' },
    ...overrides,
  }
}

function createSuccessMetadata(
  overrides: Partial<FileMetadataSuccessType> = {}
): FileMetadataSuccessType {
  return {
    status: 'success',
    fileNames: ['source.csv'],
    fileSizes: [100, 200],
    parseDate: '2026-03-13T10:00:00.000Z',
    parseSettings: createParseSettings(),
    parseDuration: 3,
    gazePlotterVersion: '1.7.0',
    clientUserAgent: 'Agent/1.0',
    ...overrides,
  }
}

function createFailureMetadata(
  overrides: Partial<FileMetadataFailureType> = {}
): FileMetadataFailureType {
  return {
    status: 'failure',
    fileNames: ['broken.csv'],
    fileSizes: [400],
    parseDate: '2026-03-13T10:00:00.000Z',
    errorId: 99,
    errorCreatedAt: '2026-03-13T10:00:01.000Z',
    userMessage: 'Could not parse file.',
    debugMessage: 'Column count mismatch',
    stack: 'Error: Column count mismatch',
    attemptedParseDuration: 1.5,
    gazePlotterVersion: '1.7.0',
    clientUserAgent: 'Agent/1.0',
    ...overrides,
  }
}

describe('metadata-info helpers', () => {
  it('builds overview counts from metadata', () => {
    const overview = buildMetadataOverview(createMockMetadata())

    expect(overview).toEqual({
      numberOfStimuli: 2,
      numberOfParticipants: 2,
      segmented: false,
      spatial: false,
      event: false,
      aoiCounts: {
        perStimulus: [
          { stimulusName: 'Stimulus1', count: 0 },
          { stimulusName: 'Stimulus2', count: 2 },
        ],
        total: 2,
      },
    })
  })

  it('includes spatial availability in overview when provided', () => {
    const overview = buildMetadataOverview(createMockMetadata(), {
      segmented: true,
      spatial: true,
      event: false,
    })
    expect(overview.spatial).toBe(true)
  })

  it('compares current parsing to source metadata by names, sizes, and parse date', () => {
    const current: FileInputType = {
      fileNames: ['source.csv'],
      fileSizes: [100, 200],
      parseDate: '2026-03-13T10:00:00.000Z',
    }

    expect(isCurrentParsingSameAsSource(current, createSuccessMetadata())).toBe(
      true
    )

    expect(
      isCurrentParsingSameAsSource(
        current,
        createSuccessMetadata({ fileSizes: [100, 201] })
      )
    ).toBe(false)

    expect(isCurrentParsingSameAsSource(current, null)).toBe(false)
  })

  it('reads browser memory info safely and formats utilization', () => {
    expect(getMetadataMemoryInfo({})).toEqual({
      used: 0,
      total: 0,
      limit: 0,
      available: false,
    })

    const memoryInfo = getMetadataMemoryInfo({
      memory: {
        usedJSHeapSize: 25,
        totalJSHeapSize: 50,
        jsHeapSizeLimit: 100,
      },
    })

    expect(memoryInfo).toEqual({
      used: 25,
      total: 50,
      limit: 100,
      available: true,
    })
    expect(formatMemoryUtilization(memoryInfo)).toBe('25.0% of limit')
  })

  it('builds a success CSV report with overview, current parsing, source parsing, and recent errors', () => {
    const csv = buildMetadataCsvReport(
      {
        overview: buildMetadataOverview(createMockMetadata()),
        memoryInfo: {
          used: 25,
          total: 50,
          limit: 100,
          available: true,
        },
        currentFileInput: {
          fileNames: ['current.csv'],
          fileSizes: [300],
          parseDate: '2026-03-14T10:00:00.000Z',
        },
        isSameAsSource: false,
        fileMetadata: createSuccessMetadata(),
        recentErrors: [createRecentError()],
        generatedAt: '2026-03-14T12:00:00.000Z',
      },
      csvFormatters
    )

    expect(csv).toContain('GazePlotter Metadata Export')
    expect(csv).toContain('Generated,2026-03-14T12:00:00.000Z')
    expect(csv).toContain('Section,Current Parsing')
    expect(csv).toContain('Total File Size,SIZE(300)')
    expect(csv).toContain('Parse Date,DATE(2026-03-14T10:00:00.000Z)')
    expect(csv).toContain('Segmented,No')
    expect(csv).toContain('Spatial,No')
    expect(csv).toContain('Event,No')
    expect(csv).toContain('Section,Source Parsing')
    expect(csv).toContain('Status,SUCCESS')
    expect(csv).toContain('Parse Duration,DURATION(3)')
    expect(csv).toContain('User Input Setting,manual')
    expect(csv).toContain('Section,Recent Errors')
    expect(csv).toContain('"recoverable"')
    expect(csv).toContain('Memory utilization,25.0% of limit')
  })

  it('builds a failure CSV report and omits current parsing when it matches the source input', () => {
    const fileMetadata = createFailureMetadata()
    const csv = buildMetadataCsvReport(
      {
        overview: buildMetadataOverview(null),
        memoryInfo: {
          used: 0,
          total: 0,
          limit: 0,
          available: false,
        },
        currentFileInput: {
          fileNames: ['broken.csv'],
          fileSizes: [400],
          parseDate: '2026-03-13T10:00:00.000Z',
        },
        isSameAsSource: true,
        fileMetadata,
        recentErrors: [],
        generatedAt: '2026-03-14T12:00:00.000Z',
      },
      csvFormatters
    )

    expect(csv).not.toContain('Section,Current Parsing')
    expect(csv).toContain('Section,Source Parsing - FAILED')
    expect(csv).toContain('Error ID,99')
    expect(csv).toContain('Attempted Parse Duration,DURATION(1.5)')
    expect(csv).toContain('Client,"Agent/1.0"')
    expect(csv).toContain('Section,Error Stack Trace')
    expect(csv).toContain('"Error: Column count mismatch"')
  })

  it('builds export filenames with the ISO calendar date', () => {
    expect(
      buildMetadataExportFileName(new Date('2026-03-14T12:34:56.000Z'))
    ).toBe('GazePlotter_Metadata_2026-03-14.csv')
  })
})
