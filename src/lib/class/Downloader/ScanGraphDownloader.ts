import { AbstractDownloader } from './AbstractDownloader.ts'
import { getNumberOfParticipants, getNumberOfSegments, getParticipant, getSegment } from '$lib/stores/dataStore.ts'
import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType.ts'

export class ScanGraphDownloader extends AbstractDownloader {
  download (stimulusId: number, fileName: string): void {
    const content = this.getStimulusScanGraphString(stimulusId)
    const txtFileContent = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    this.triggerDownload(txtFileContent, fileName, '.txt')
  }

  getStimulusScanGraphString (stimulusId: number): string {
    let result = ''
    const aoiKey: string[] = []
    const alreadyUsedAoiIds: number[] = []
    for (let i = 0; i < getNumberOfParticipants(); i++) {
      result += getParticipant(i).originalName + '\t'
      for (let j = 0; j < getNumberOfSegments(stimulusId, i); j++) {
        const aoi = getSegment(stimulusId, i, j).aoi
        result += this.getAoiString(aoi)
        if (aoi.length === 0) continue
        if (alreadyUsedAoiIds.includes(aoi[0].id)) continue
        aoiKey.push(this.getAoiKeyPart(aoi))
        if (aoi[0] === undefined) continue
        alreadyUsedAoiIds.push(aoi[0].id)
      }
      result += '\r\n'
    }
    aoiKey.sort()
    return this.getHeaderString(aoiKey.join(', ')) + result
  }

  getHeaderString (aoiKey: string): string {
    return `#
#
#
# Key:
# # = no fixation, ${aoiKey}
#
# The following part is the sequence similarity of the scanpaths
#
Sequence Similarity\tScanpath string
`
  }

  getAoiString (aoi: ExtendedInterpretedDataType[]): string {
    if (aoi.length === 0) return '#'
    return this.getAoiLetter(aoi[0].id)
  }

  getAoiLetter (aoi: number): string {
    return String.fromCharCode(65 + aoi)
  }

  getAoiKeyPart (aoi: ExtendedInterpretedDataType[]): string {
    if (aoi.length === 0) return ''
    const name = aoi[0].displayedName
    return `${this.getAoiLetter(aoi[0].id)} = ${name}`
  }
}
