import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'
import { ScarfDownloader } from '../../../Back/Downloader/ScarfDownloader'

export class ScarfDownloadModalModel extends AbstractModalModel {
  stimulus: number
  scarfId: number
  constructor (workplace: WorkplaceModel, stimulus: number, scarfId: number) {
    super(workplace, 'Scarf Chart Settings')
    this.stimulus = stimulus
    this.scarfId = scarfId
  }

  downloadScarf (fileName: string, fileType: string, width: string, el: HTMLElement): void {
    this.addFlash('Rendering picture for export', 'info')
    void new ScarfDownloader().download(fileName, fileType, width, el)
    this.addFlash('Download started', 'success')
    this.notify('close-modal')
  }
}
