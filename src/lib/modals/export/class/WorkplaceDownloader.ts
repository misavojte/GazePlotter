import { AbstractDownloader } from './AbstractDownloader'
import type { DataType, JsonImportNewFormat } from '$lib/gaze-data/shared/types'
import { binarySegmentsToJson } from '$lib/gaze-data/shared/types'
import { convertDataStructure } from '$lib/shared/utils/convertDataStructure'
import {
  type CsvFormatOptions,
  escapeCsvField,
  formatNumberForCsv,
  resolveCsvFormatOptions,
} from '$lib/shared/utils/csvFormatUtils'
import { gridStore } from '$lib/workspace/stores/gridStore'
import { get } from 'svelte/store'
import JSZip from 'jszip'
import { fileMetadataStore } from '$lib/workspace/stores/fileStore'

export class WorkplaceDownloader extends AbstractDownloader {
  download(data: DataType, fileName: string): void {
    // Convert binary segments to JSON format for export
    const exportData = {
      ...data,
      segments: binarySegmentsToJson(data.segments),
    }

    // add to the data the grid items
    const fileMetadata = get(fileMetadataStore)
    const dataWithGridItems: JsonImportNewFormat = fileMetadata
      ? {
          version: 3,
          data: exportData,
          gridItems: get(gridStore),
          fileMetadata,
        }
      : {
          version: 2,
          data: exportData,
          gridItems: get(gridStore),
        }
    const json = JSON.stringify(dataWithGridItems)
    const content = URL.createObjectURL(
      new Blob([json], { type: 'application/json' })
    )
    super.triggerDownload(content, fileName, '.json')
  }

  downloadCSV(
    data: DataType,
    fileName: string,
    options?: CsvFormatOptions
  ): void {
    const { delimiter, decimalSeparator } = resolveCsvFormatOptions(options)
    const csvPreData = convertDataStructure(data)
    const csvData = csvPreData
      .map(item => {
        const aoiNames = item.AOI ? item.AOI.join(';') : ''
        return [
          escapeCsvField(item.stimulus, delimiter),
          escapeCsvField(item.participant, delimiter),
          escapeCsvField(
            formatNumberForCsv(item.timestamp, decimalSeparator),
            delimiter
          ),
          escapeCsvField(
            formatNumberForCsv(item.duration, decimalSeparator),
            delimiter
          ),
          escapeCsvField(
            formatNumberForCsv(item.eyemovementtype, decimalSeparator),
            delimiter
          ),
          escapeCsvField(aoiNames, delimiter),
        ].join(delimiter)
      })
      .join('\n')
    const csvHeader = [
      'stimulus',
      'participant',
      'timestamp',
      'duration',
      'eyemovementtype',
      'AOI',
    ].join(delimiter)
    const csvContent = `${csvHeader}\n${csvData}`
    const content = URL.createObjectURL(
      new Blob([csvContent], { type: 'text/csv' })
    )
    super.triggerDownload(content, fileName, '.csv')
  }

  async downloadIndividualCSV(
    data: DataType,
    fileName: string,
    filterFixations: boolean = false,
    options?: CsvFormatOptions
  ): Promise<void> {
    const { delimiter, decimalSeparator } = resolveCsvFormatOptions(options)
    const csvPreData = convertDataStructure(data)
    const zip = new JSZip()

    const participants = new Set(csvPreData.map(item => item.participant))
    const stimuli = new Set(csvPreData.map(item => item.stimulus))

    participants.forEach(participant => {
      stimuli.forEach(stimulus => {
        const combinedData = csvPreData.filter(
          item => item.participant === participant && item.stimulus === stimulus
        )

        // Filter out non-fixation data if the option is enabled
        const filteredData = filterFixations
          ? combinedData.filter(item => item.eyemovementtype === '0')
          : combinedData

        const csvData = filteredData
          .map(item => {
            const aoiNames = item.AOI ? item.AOI.join(';') : ''
            return [
              escapeCsvField(
                formatNumberForCsv(item.timestamp, decimalSeparator),
                delimiter
              ),
              escapeCsvField(
                formatNumberForCsv(item.duration, decimalSeparator),
                delimiter
              ),
              escapeCsvField(
                formatNumberForCsv(item.eyemovementtype, decimalSeparator),
                delimiter
              ),
              escapeCsvField(aoiNames, delimiter),
            ].join(delimiter)
          })
          .join('\n')
        const csvHeader = ['timestamp', 'duration', 'eyemovementtype', 'AOI']
          .map(value => escapeCsvField(value, delimiter))
          .join(delimiter)
        const csvContent = `${csvHeader}\n${csvData}`

        zip.file(`${stimulus}_${participant}_${fileName}.csv`, csvContent)
      })
    })

    const zipContent = await zip.generateAsync({ type: 'blob' })
    const content = URL.createObjectURL(zipContent)
    super.triggerDownload(content, fileName, '.zip')
  }
}
