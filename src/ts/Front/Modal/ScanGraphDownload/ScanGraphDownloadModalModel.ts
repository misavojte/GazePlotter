import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'
import { ScanGraphDownloader } from '../../../Back/Downloader/ScanGraphDownloader'

export class ScanGraphDownloadModalModel extends AbstractModalModel {
  constructor (workplace: WorkplaceModel) {
    super(workplace, 'ScanGraph Download')
  }

  fireDownload (fileName: string, stimulus: number): void {
    this.addFlash('Preparing data for download', 'info')
    try {
      const downloader = new ScanGraphDownloader()
      downloader.download(this.data, stimulus, fileName)
      this.addFlash('Download started', 'info')
      this.fireClose()
    } catch (e) {
      console.error(e)
      this.addFlash('Download failed', 'error')
    }
  }
}
