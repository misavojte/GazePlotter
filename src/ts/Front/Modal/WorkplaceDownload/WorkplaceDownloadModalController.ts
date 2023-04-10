import { AbstractModalController } from '../AbstractModalController'
import { WorkplaceDownloadModalModel } from './WorkplaceDownloadModalModel'

export class WorkplaceDownloadModalController extends AbstractModalController {
  model: WorkplaceDownloadModalModel
  constructor (model: WorkplaceDownloadModalModel) {
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
