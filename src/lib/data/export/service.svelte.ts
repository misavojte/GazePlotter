import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ErrorService } from '$lib/errors'
import type { GridState } from '$lib/workspace/grid/store.svelte'
import type { IngestService } from '$lib/data/ingest'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import {
  downloadBatchZip,
  downloadScanpathSimilarity,
  downloadScanGraph,
  downloadUnifiedCsv,
  downloadWorkspace,
} from './controller'
import type { CsvFormatOptions } from './encoders/csv'
import {
  type AggregatedExportOptions,
  generateAggregatedCsv,
} from './mappers/aggregated'
import type { SimilarityMethod } from '$lib/plots/scanpath-similarity/types'
import { triggerDownload } from './download'

type ExportServiceDeps = {
  engine: DataEngine
  errorService: Pick<ErrorService, 'report'>
  grid: GridState
  ingest: IngestService
  toastState: Pick<ToastState, 'addSuccess'>
}

export type WorkspaceExportOptions = {
  fileName: string
}

export type SegmentedExportOptions = {
  fileName: string
  exportType: 'csv' | 'individual-csv'
  stimulusIds: Set<string>
  filterFixations?: boolean
  csvOptions?: CsvFormatOptions
}

export type ScangraphExportOptions = {
  fileName: string
  stimulusId: number
}

export type ScanpathSimilarityExportOptions = {
  fileName: string
  stimulusId: number
  groupId: number
  similarityMethod: SimilarityMethod
  collapsed: boolean
  csvOptions?: CsvFormatOptions
}

export class ExportService {
  constructor(private readonly deps: ExportServiceDeps) {}

  private getExportData() {
    const meta = this.deps.engine.metadata
    const segments = this.deps.engine.segments
    if (!meta || !segments) {
      throw new Error('Data engine metadata or segments not available')
    }
    return { ...meta, segments }
  }

  private resolveFileName(fileName: string): string {
    const trimmed = fileName.trim()
    if (trimmed.length === 0) {
      throw new Error('File name cannot be empty')
    }
    return trimmed
  }

  private async runExport(
    action: () => void | Promise<void>,
    successMessage: string,
    context?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      await action()
      this.deps.toastState.addSuccess(successMessage)
      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Export failed unexpectedly'
      this.deps.errorService.report({
        origin: 'export',
        severity: 'recoverable',
        userMessage: message,
        cause: error,
        context,
      })
      return false
    }
  }

  async exportWorkspace(options: WorkspaceExportOptions): Promise<boolean> {
    return this.runExport(() => {
      downloadWorkspace(
        this.getExportData(),
        this.resolveFileName(options.fileName),
        this.deps.grid.items,
        this.deps.ingest.metadata
      )
    }, 'Workspace exported successfully', {
      exportType: 'workspace',
      fileName: options.fileName,
    })
  }

  async exportSegmentedData(options: SegmentedExportOptions): Promise<boolean> {
    return this.runExport(async () => {
      if (options.stimulusIds.size === 0) {
        throw new Error('Select at least one stimulus to export')
      }

      const data = this.getExportData()
      const fileName = this.resolveFileName(options.fileName)

      if (options.exportType === 'csv') {
        downloadUnifiedCsv(
          data,
          fileName,
          options.stimulusIds,
          options.filterFixations ?? false,
          options.csvOptions
        )
        return
      }

      await downloadBatchZip(
        data,
        fileName,
        options.stimulusIds,
        options.filterFixations ?? false,
        options.csvOptions
      )
    },
      options.exportType === 'csv'
        ? 'Single CSV file exported successfully'
        : 'Individual CSV files exported and zipped successfully',
      {
        exportType: options.exportType,
        fileName: options.fileName,
        stimulusCount: options.stimulusIds.size,
        filterFixations: options.filterFixations ?? false,
      }
    )
  }

  async exportScangraph(options: ScangraphExportOptions): Promise<boolean> {
    return this.runExport(
      () =>
        downloadScanGraph(
          this.deps.engine,
          options.stimulusId,
          this.resolveFileName(options.fileName)
        ),
      'ScanGraph file exported successfully',
      {
        exportType: 'scangraph',
        fileName: options.fileName,
        stimulusId: options.stimulusId,
      }
    )
  }

  async exportScanpathSimilarity(
    options: ScanpathSimilarityExportOptions
  ): Promise<boolean> {
    const fileName = this.resolveFileName(options.fileName)
    return this.runExport(
      () =>
        downloadScanpathSimilarity(this.deps.engine, {
          ...options,
          fileName,
        }),
      'Scanpath similarity matrix exported successfully',
      {
        exportType: 'scanpath-similarity',
        fileName: options.fileName,
        stimulusId: options.stimulusId,
        groupId: options.groupId,
        similarityMethod: options.similarityMethod,
        collapsed: options.collapsed,
      }
    )
  }

  async exportAggregatedData(
    options: AggregatedExportOptions
  ): Promise<boolean> {
    return this.runExport(() => {
      if (options.metrics.length === 0) {
        throw new Error('Select at least one metric to export')
      }
      if (options.stimulusIds.length === 0) {
        throw new Error('Select at least one stimulus to export')
      }

      const fileName = this.resolveFileName(options.fileName)
      const result = generateAggregatedCsv(this.deps.engine, {
        ...options,
        fileName,
      })
      triggerDownload(result.content, fileName, '.csv')
    },
      (() => {
        const metricCount = options.metrics.length
        const stimulusCount = options.stimulusIds.length
        return `Exported aggregated data (${metricCount} metrics across ${stimulusCount} ${stimulusCount === 1 ? 'stimulus' : 'stimuli'})`
      })(),
      {
        exportType: 'aggregated',
        fileName: options.fileName,
        metricCount: options.metrics.length,
        stimulusCount: options.stimulusIds.length,
        groupId: options.groupId,
      }
    )
  }
}
