import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { DataType } from '$lib/data/types'
import type { ErrorService } from '$lib/errors'
import type { GridState } from '$lib/workspace/grid/gridState.svelte'
import type { IngestService } from '$lib/data/ingest'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import {
  downloadBatchZip,
  downloadEventBatchZip,
  downloadEventUnifiedCsv,
  downloadScanGraph,
  downloadUnifiedCsv,
  downloadWorkspace,
} from './controller'
import type { CsvFormatOptions } from './encoders/csv'
import type { ExportNaming } from './types'
import {
  type MetricDataExportOptions,
  generateMetricExport,
} from './mappers/metrics'
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
  participantIds: Set<string>
  filterCategoryIds?: Set<number>
  csvOptions?: CsvFormatOptions
  naming?: ExportNaming
}

export type EventExportOptions = {
  fileName: string
  exportType: 'csv' | 'individual-csv'
  stimulusIds: Set<string>
  participantIds: Set<string>
  csvOptions?: CsvFormatOptions
  naming?: ExportNaming
}

export type ScangraphExportOptions = {
  fileName: string
  stimulusId: number
}

export type FigureBatchExportOptions = {
  fileName: string
  /** Rendered figure images, already encoded; names are complete zip entry names. */
  files: Array<{ name: string; content: Blob }>
  /** How many figures the user selected — the toast reports partial coverage. */
  requestedCount: number
}

export class ExportService {
  progress = $state<{ position: number; total: number; name: string } | null>(null)

  constructor(private readonly deps: ExportServiceDeps) {}

  private getExportData(): DataType {
    const meta = this.deps.engine.metadata
    const segments = this.deps.engine.segments
    if (!meta || !segments) {
      throw new Error('Data engine metadata or segments not available')
    }
    // Re-stitch the binary stores the engine holds outside `metadata` back
    // into the serializable shape: segments and the event occurrence buffers.
    return {
      ...meta,
      segments,
      eventData: {
        ...meta.eventData,
        events: this.deps.engine.getEventBuffersJson(),
      },
    }
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
    /** A thunk resolves AFTER the action, so the message can report what the
     *  export actually produced (e.g. the row count). */
    successMessage: string | (() => string),
    context?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      await action()
      this.deps.toastState.addSuccess(
        typeof successMessage === 'function' ? successMessage() : successMessage
      )
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
    } finally {
      this.progress = null
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
      if (options.participantIds.size === 0) {
        throw new Error('Select at least one participant to export')
      }

      const data = this.getExportData()
      const fileName = this.resolveFileName(options.fileName)
      const naming = options.naming ?? 'displayed'

      if (options.exportType === 'csv') {
        await downloadUnifiedCsv(
          data,
          fileName,
          options.stimulusIds,
          options.participantIds,
          options.filterCategoryIds,
          options.csvOptions,
          naming,
          (position, total, name) => {
            this.progress = { position, total, name }
          }
        )
        return
      }

      await downloadBatchZip(
        data,
        fileName,
        options.stimulusIds,
        options.participantIds,
        options.filterCategoryIds,
        options.csvOptions,
        naming,
        (position, total, name) => {
          this.progress = { position, total, name }
        }
      )
    },
      options.exportType === 'csv'
        ? 'Single CSV file exported successfully'
        : 'Individual CSV files exported and zipped successfully',
      {
        exportType: options.exportType,
        fileName: options.fileName,
        stimulusCount: options.stimulusIds.size,
        participantCount: options.participantIds.size,
        filterCategoryIds: options.filterCategoryIds
          ? Array.from(options.filterCategoryIds)
          : undefined,
        naming: options.naming ?? 'displayed',
      }
    )
  }

  async exportEventData(options: EventExportOptions): Promise<boolean> {
    return this.runExport(async () => {
      if (options.stimulusIds.size === 0) {
        throw new Error('Select at least one stimulus to export')
      }
      if (options.participantIds.size === 0) {
        throw new Error('Select at least one participant to export')
      }

      const data = this.getExportData()
      const fileName = this.resolveFileName(options.fileName)
      const naming = options.naming ?? 'displayed'

      if (options.exportType === 'csv') {
        await downloadEventUnifiedCsv(
          data,
          fileName,
          options.stimulusIds,
          options.participantIds,
          options.csvOptions,
          naming,
          (position, total, name) => {
            this.progress = { position, total, name }
          }
        )
        return
      }

      await downloadEventBatchZip(
        data,
        fileName,
        options.stimulusIds,
        options.participantIds,
        options.csvOptions,
        naming,
        (position, total, name) => {
          this.progress = { position, total, name }
        }
      )
    },
      options.exportType === 'csv'
        ? 'Single CSV file exported successfully'
        : 'Individual CSV files exported and zipped successfully',
      {
        exportType: options.exportType,
        fileName: options.fileName,
        stimulusCount: options.stimulusIds.size,
        participantCount: options.participantIds.size,
        naming: options.naming ?? 'displayed',
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

  /** Download pre-rendered figure images: a single requested figure as a bare
   *  image, several bundled into one ZIP. Rendering happens in the modal
   *  (figures are live Svelte components); this owns the packaging, download,
   *  and user acknowledgement. */
  async exportFigures(options: FigureBatchExportOptions): Promise<boolean> {
    return this.runExport(
      async () => {
        if (options.files.length === 0) {
          throw new Error('No figures could be rendered for export')
        }
        const fileName = this.resolveFileName(options.fileName)

        if (options.requestedCount === 1) {
          const file = options.files[0]
          const extension = file.name.slice(file.name.lastIndexOf('.'))
          triggerDownload(file.content, fileName, extension)
          return
        }

        const { Archiver } = await import('./encoders/zip')
        const archiver = new Archiver()
        for (const file of options.files) {
          archiver.addFile(file.name, file.content)
        }
        const zipBlob = await archiver.generateBlob()
        triggerDownload(zipBlob, fileName, '.zip')
      },
      () => {
        const count = options.files.length
        return count === options.requestedCount
          ? `Exported ${count} ${count === 1 ? 'figure' : 'figures'}`
          : `Exported ${count} of ${options.requestedCount} figures`
      },
      {
        exportType: 'figures',
        fileName: options.fileName,
        figureCount: options.files.length,
        requestedCount: options.requestedCount,
      }
    )
  }

  async exportMetricData(
    options: MetricDataExportOptions
  ): Promise<boolean> {
    let exportedRows = 0
    return this.runExport(async () => {
      if (options.metricInstanceIds.length === 0) {
        throw new Error('Select at least one metric to export')
      }
      if (options.stimulusIds.length === 0) {
        throw new Error('Select at least one stimulus to export')
      }
      if (options.participantIds.length === 0) {
        throw new Error('Select at least one participant to export')
      }

      const fileName = this.resolveFileName(options.fileName)
      const result = await generateMetricExport(
        this.deps.engine,
        {
          ...options,
          fileName,
        },
        (position, total, name) => {
          this.progress = { position, total, name }
        }
      )
      exportedRows = result.rows

      if (options.includeCodebook && result.codebookContent !== null) {
        const { Archiver } = await import('./encoders/zip')
        const archiver = new Archiver()
        archiver.addFile(`${fileName}.csv`, result.dataContent)
        archiver.addFile(`${fileName}-codebook.csv`, result.codebookContent)
        const zipBlob = await archiver.generateBlob()
        triggerDownload(zipBlob, fileName, '.zip')
      } else {
        triggerDownload(result.dataContent, fileName, '.csv')
      }
    },
      () => {
        const metricCount = options.metricInstanceIds.length
        const stimulusCount = options.stimulusIds.length
        return `Exported ${exportedRows} rows (${metricCount} ${metricCount === 1 ? 'metric' : 'metrics'} across ${stimulusCount} ${stimulusCount === 1 ? 'stimulus' : 'stimuli'})`
      },
      {
        exportType: 'metric-data',
        fileName: options.fileName,
        metricCount: options.metricInstanceIds.length,
        stimulusCount: options.stimulusIds.length,
        participantCount: options.participantIds.length,
        format: options.format,
      }
    )
  }
}
