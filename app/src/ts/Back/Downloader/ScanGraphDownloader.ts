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
    for (let i = 0; i < data.noOfParticipants; i++) {
      result += data.getParticOriginalName(i) + '\t'
      for (let j = 0; j < data.getNoOfSegments(stimulusId, i); j++) {
        const aoi = data.getSegmentInfo(stimulusId, i, j).aoi
        result += aoi.length > 0 ? aoi.join('') : '#'
      }
      result += '\r\n'
    }
    console.log(this.getHeaderString() + result)
    return this.getHeaderString() + result
  }

  getHeaderString (): string {
    return `#
#
#
#
#
#
# The following part is the sequence similarity of the scanpaths
#
Sequence Similarity\tScanpath string
`
  }
}
