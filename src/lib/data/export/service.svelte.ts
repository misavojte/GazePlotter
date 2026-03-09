import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { GridState } from '$lib/workspace/grid/store.svelte'
import type { IngestService } from '$lib/data/ingest'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import {
  downloadBatchZip,
  downloadScanGraph,
  downloadUnifiedCsv,
  downloadWorkplace,
} from './controller'
import type { CsvFormatOptions } from './encoders/csv'
import {
  type AggregatedExportOptions,
  generateAggregatedCsv,
} from './mappers/aggregated'
import { triggerDownload } from './download'

type ExportServiceDeps = {
  engine: DataEngine
  grid: GridState
  ingest: IngestService
  toastState: Pick<ToastState, 'addSuccess' | 'addError'>
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
    successMessage: string
  ): Promise<void> {
    try {
      await action()
      this.deps.toastState.addSuccess(successMessage)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Export failed unexpectedly'
      this.deps.toastState.addError(message)
      throw error
    }
  }

  async exportWorkspace(options: WorkspaceExportOptions): Promise<void> {
    await this.runExport(() => {
      downloadWorkplace(
        this.getExportData(),
        this.resolveFileName(options.fileName),
        this.deps.grid.items,
        this.deps.ingest.metadata
      )
    }, 'Workspace exported successfully')
  }

  async exportSegmentedData(options: SegmentedExportOptions): Promise<void> {
    await this.runExport(async () => {
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
        : 'Individual CSV files exported and zipped successfully'
    )
  }

  async exportScangraph(options: ScangraphExportOptions): Promise<void> {
    await this.runExport(
      () =>
        downloadScanGraph(
          this.deps.engine,
          options.stimulusId,
          this.resolveFileName(options.fileName)
        ),
      'ScanGraph file exported successfully'
    )
  }

  async exportAggregatedData(options: AggregatedExportOptions): Promise<void> {
    await this.runExport(() => {
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
      return Promise.resolve({
        rows: result.rows,
        metricCount: result.metricCount,
        stimulusCount: result.stimulusCount,
      }).then(() => {})
    },
      (() => {
        const metricCount = options.metrics.length
        const stimulusCount = options.stimulusIds.length
        return `Exported aggregated data (${metricCount} metrics across ${stimulusCount} ${stimulusCount === 1 ? 'stimulus' : 'stimuli'})`
      })()
    )
  }
}
