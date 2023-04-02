import { AbstractDownloader } from './AbstractDownloader'
import { EyeTrackingData } from '../../Data/EyeTrackingData'

export class ScanGraphDownloader extends AbstractDownloader {
  download (data: EyeTrackingData, stimulusId: number, fileName: string): void {
    const content = this.getStimulusScanGraphString(data, stimulusId)
    const txtFileContent = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    this.triggerDownload(txtFileContent, fileName, '.txt')
  }

  getStimulusScanGraphString (data: EyeTrackingData, stimulusId: number): string {
    let result = ''
    const aoiKey: string[] = []
    const alreadyUsedAoiIds: number[] = []
    for (let i = 0; i < data.noOfParticipants; i++) {
      result += data.getParticOriginalName(i) + '\t'
      for (let j = 0; j < data.getNoOfSegments(stimulusId, i); j++) {
        const aoi = data.getSegmentInfo(stimulusId, i, j).aoi
        result += this.getAoiString(aoi)
        if (alreadyUsedAoiIds.includes(aoi[0]) || aoi.length === 0) continue
        aoiKey.push(this.getAoiKeyPart(aoi, stimulusId, data))
        if (aoi[0] === undefined) continue
        alreadyUsedAoiIds.push(aoi[0])
      }
      result += '\r\n'
    }
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

  getAoiString (aoi: number[]): string {
    if (aoi.length === 0) return '#'
    return this.getAoiLetter(aoi[0])
  }

  getAoiLetter (aoi: number): string {
    return String.fromCharCode(65 + aoi)
  }

  getAoiKeyPart (aoi: number[], stimulusId: number, data: EyeTrackingData): string {
    if (aoi.length === 0) return ''
    const name = data.getAoiInfo(stimulusId, aoi[0]).displayedName
    return `${this.getAoiLetter(aoi[0])} = ${name}`
  }
}
