import { AbstractDownloader } from './AbstractDownloader'
import type { DataType } from '$lib/gaze-data/shared/types'
import { convertDataStructure } from '$lib/shared/utils/convertDataStructure'
import { gridStore } from '$lib/workspace/stores/gridStore'
import { get } from 'svelte/store'
import JSZip from 'jszip'

export class WorkplaceDownloader extends AbstractDownloader {
  download(data: DataType, fileName: string): void {
    // add to the data the grid items
    const dataWithGridItems = {
      version: 2,
      data,
      gridItems: get(gridStore),
    }
    const json = JSON.stringify(dataWithGridItems)
    const content = URL.createObjectURL(
      new Blob([json], { type: 'application/json' })
    )
    super.triggerDownload(content, fileName, '.json')
  }

  downloadCSV(data: DataType, fileName: string): void {
    const csvPreData = convertDataStructure(data)
    const csvData = csvPreData
      .map(item => {
        const aoiNames = item.AOI ? item.AOI.join(';') : ''
        return [
          item.stimulus,
          item.participant,
          item.timestamp,
          item.duration,
          item.eyemovementtype,
          aoiNames,
        ].join(',')
      })
      .join('\n')
    const csvHeader =
      'stimulus,participant,timestamp,duration,eyemovementtype,AOI'
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
          .map(item => {
            const aoiNames = item.AOI ? item.AOI.join(';') : ''
            return [
              item.timestamp,
              item.duration,
              item.eyemovementtype,
              aoiNames,
            ].join(',')
          })
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
