import { AbstractDownloader } from './AbstractDownloader.ts'
import type { DataType } from '$lib/type/Data/DataType.ts'
import { convertDataStructure } from '$lib/utils/convertDataStructure.ts'
import JSZip from 'jszip'

export class WorkplaceDownloader extends AbstractDownloader {
  download(data: DataType, fileName: string): void {
    const json = JSON.stringify(data)
    const content = URL.createObjectURL(
      new Blob([json], { type: 'application/json' })
    )
    super.triggerDownload(content, fileName, '.json')
  }

  downloadCSV(data: DataType, fileName: string): void {
    const csvPreData = convertDataStructure(data)
    const csvData = csvPreData
      .map(item => Object.values(item).join(','))
      .join('\n')
    const csvHeader = Object.keys(csvPreData[0]).join(',')
    const csvContent = `${csvHeader}\n${csvData}`
    const content = URL.createObjectURL(
      new Blob([csvContent], { type: 'text/csv' })
    )
    super.triggerDownload(content, fileName, '.csv')
  }

  async downloadIndividualCSV(
    data: DataType,
    fileName: string,
    filterFixations: boolean = false
  ): Promise<void> {
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
          .map(item =>
            [
              item.timestamp,
              item.duration,
              item.eyemovementtype,
              item.AOI,
            ].join(',')
          )
          .join('\n')
        const csvHeader = 'timestamp,duration,eyemovementtype,AOI'
        const csvContent = `${csvHeader}\n${csvData}`

        zip.file(`${stimulus}_${participant}_${fileName}.csv`, csvContent)
      })
    })

    const zipContent = await zip.generateAsync({ type: 'blob' })
    const content = URL.createObjectURL(zipContent)
    super.triggerDownload(content, fileName, '.zip')
  }
}
