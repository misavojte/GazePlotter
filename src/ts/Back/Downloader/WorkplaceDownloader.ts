import { AbstractDownloader } from './AbstractDownloader'
import { EyeTrackingData } from '../../Data/EyeTrackingData'

export class WorkplaceDownloader extends AbstractDownloader {
  download (data: EyeTrackingData, fileName: string): void {
    const json = JSON.stringify(data)
    const content = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    super.triggerDownload(content, fileName, '.json')
  }
}
