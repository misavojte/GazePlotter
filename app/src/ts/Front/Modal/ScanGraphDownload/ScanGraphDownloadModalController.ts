import { AbstractModalController } from '../AbstractModalController'
import { ScanGraphDownloadModalModel } from './ScanGraphDownloadModalModel'

export class ScanGraphDownloadModalController extends AbstractModalController {
  model: ScanGraphDownloadModalModel
  constructor (model: ScanGraphDownloadModalModel) {
    super()
    this.model = model
  }

  handleSubmitEvent (e: Event): void {
    const target = e.target as HTMLFormElement
    const formData = new FormData(target)
    const fileName = formData.get('file_name') as string
    this.model.fireDownload(fileName)
  }
}
