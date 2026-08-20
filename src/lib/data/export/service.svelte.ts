import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { DataType } from '$lib/data/types'
import type { ErrorService } from '$lib/errors'
import type { GridState } from '$lib/workspace/grid/gridState.svelte'
import type { IngestService } from '$lib/data/ingest'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import {
  buildBatchZip,
  buildEventBatchZip,
  buildEventUnifiedCsv,
  buildScanGraph,
  buildUnifiedCsv,
  buildWorkspace,
  type ExportPayload,
} from './controller'
import type { CsvFormatOptions } from './encoders/csv'
import { unfoldMerges } from '$lib/data/merge/applyMerges'
import type { ExportNaming } from './types'
import {
  type MetricDataExportOptions,
  generateMetricExport,
} from './mappers/metrics'
import type { SaveFile } from './download'
import type { ExportProgress } from './progress'

type ExportServiceDeps = {
  engine: DataEngine
  errorService: Pick<ErrorService, 'report'>
  grid: GridState
  ingest: IngestService
  toastState: Pick<ToastState, 'addSuccess'>
  /** Session-resolved `saveFile` embedding option (web: anchor download). */
  saveFile: SaveFile
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
  /** Fold consecutive same-AOI fixations ("AABBC" → "ABC") before export. */
  collapsed: boolean
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

  /** Progress sink handed to the builders. */
  private readonly track: ExportProgress = (position, total, name) => {
    this.progress = { position, total, name }
  }

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

  /** Single delivery point: applies the extension-join policy, then hands
   *  the payload to the host's saveFile. */
  private deliver({ content, extension }: ExportPayload, fileName: string): void {
    const finalName = fileName.endsWith(extension)
      ? fileName
      : fileName + extension
    this.deps.saveFile(content, finalName, extension)
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
      // Original-on-disk (PLANMERGE §4): persist the pristine pre-merge data +
      // the merge log, not the folded working view. `unfoldMerges` is a no-op
      // when nothing is merged. The merged view is re-derived on load.
      this.deliver(
        buildWorkspace(
          unfoldMerges(this.getExportData()),
          this.deps.grid.items,
          this.deps.ingest.metadata
        ),
        this.resolveFileName(options.fileName)
      )
    }, 'Workspace exported successfully', {
      exportType: 'workspace',
      fileName: options.fileName,
    })
  }

  /** Shared shell of the two tabular exports: selection guards, naming,
   *  build, deliver. */
  private exportCsvOrZip(
    options: Pick<
      SegmentedExportOptions,
      'fileName' | 'exportType' | 'stimulusIds' | 'participantIds' | 'naming'
    >,
    context: Record<string, unknown>,
    build: (
      data: DataType,
      fileName: string,
      naming: ExportNaming
    ) => Promise<ExportPayload>
  ): Promise<boolean> {
    return this.runExport(
      async () => {
        if (options.stimulusIds.size === 0) {
          throw new Error('Select at least one stimulus to export')
        }
        if (options.participantIds.size === 0) {
          throw new Error('Select at least one participant to export')
        }
        const data = this.getExportData()
        const fileName = this.resolveFileName(options.fileName)
        this.deliver(
          await build(data, fileName, options.naming ?? 'displayed'),
          fileName
        )
      },
      options.exportType === 'csv'
        ? 'Single CSV file exported successfully'
        : 'Individual CSV files exported and zipped successfully',
      context
    )
  }

  async exportSegmentedData(options: SegmentedExportOptions): Promise<boolean> {
    return this.exportCsvOrZip(
      options,
      {
        exportType: options.exportType,
        fileName: options.fileName,
        stimulusCount: options.stimulusIds.size,
        participantCount: options.participantIds.size,
        filterCategoryIds: options.filterCategoryIds
          ? Array.from(options.filterCategoryIds)
          : undefined,
        naming: options.naming ?? 'displayed',
      },
      (data, fileName, naming) =>
        options.exportType === 'csv'
          ? buildUnifiedCsv(
              data,
              options.stimulusIds,
              options.participantIds,
              options.filterCategoryIds,
              options.csvOptions,
              naming,
              this.track
            )
          : buildBatchZip(
              data,
              fileName,
              options.stimulusIds,
              options.participantIds,
              options.filterCategoryIds,
              options.csvOptions,
              naming,
              this.track
            )
    )
  }

  async exportEventData(options: EventExportOptions): Promise<boolean> {
    return this.exportCsvOrZip(
      options,
      {
        exportType: options.exportType,
        fileName: options.fileName,
        stimulusCount: options.stimulusIds.size,
        participantCount: options.participantIds.size,
        naming: options.naming ?? 'displayed',
      },
      (data, fileName, naming) =>
        options.exportType === 'csv'
          ? buildEventUnifiedCsv(
              data,
              options.stimulusIds,
              options.participantIds,
              options.csvOptions,
              naming,
              this.track
            )
          : buildEventBatchZip(
              data,
              fileName,
              options.stimulusIds,
              options.participantIds,
              options.csvOptions,
              naming,
              this.track
            )
    )
  }

  async exportScangraph(options: ScangraphExportOptions): Promise<boolean> {
    return this.runExport(
      () =>
        this.deliver(
          buildScanGraph(this.deps.engine, options.stimulusId, options.collapsed),
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

  /** Deliver pre-rendered figure images: a single requested figure as a bare
   *  image, several bundled into one ZIP. Rendering happens in the modal
   *  (figures are live Svelte components); this owns the packaging, delivery,
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
          this.deliver({ content: file.content, extension }, fileName)
          return
        }

        const { Archiver } = await import('./encoders/zip')
        const archiver = new Archiver()
        for (const file of options.files) {
          archiver.addFile(file.name, file.content)
        }
        const zipBlob = await archiver.generateBlob()
        this.deliver({ content: zipBlob, extension: '.zip' }, fileName)
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

  /** Deliver a report a modal assembles; `buildContent` runs inside the
   *  export shell so its failures report like every other export. */
  async exportMetadataReport(options: {
    fileName: string
    buildContent: () => string
  }): Promise<boolean> {
    return this.runExport(
      () =>
        this.deliver(
          { content: options.buildContent(), extension: '.csv' },
          this.resolveFileName(options.fileName)
        ),
      'Metadata report exported successfully',
      { exportType: 'metadata-report', fileName: options.fileName }
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
        this.track
      )
      exportedRows = result.rows

      if (options.includeCodebook && result.codebookContent !== null) {
        const { Archiver } = await import('./encoders/zip')
        const archiver = new Archiver()
        archiver.addFile(`${fileName}.csv`, result.dataContent)
        archiver.addFile(`${fileName}-codebook.csv`, result.codebookContent)
        const zipBlob = await archiver.generateBlob()
        this.deliver({ content: zipBlob, extension: '.zip' }, fileName)
      } else {
        this.deliver({ content: result.dataContent, extension: '.csv' }, fileName)
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
