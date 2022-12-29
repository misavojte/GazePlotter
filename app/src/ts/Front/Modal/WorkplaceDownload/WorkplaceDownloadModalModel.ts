import { WorkplaceModel } from '../../Workplace/WorkplaceModel'
import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceDownloader } from '../../../Back/Downloader/WorkplaceDownloader'

export class WorkplaceDownloadModalModel extends AbstractModalModel {
  constructor (workplaceModel: WorkplaceModel) {
    super(workplaceModel, 'Download workplace data')
  }

  fireDownload (fileName: string): void {
    this.addFlash('Preparing data for download', 'info')
    try {
      const downloader = new WorkplaceDownloader()
      downloader.download(this.data, fileName)
      this.addFlash('Download started', 'info')
      this.fireClose()
    } catch (e) {
      console.error(e)
      this.addFlash('Download failed', 'error')
    }
  }
}
