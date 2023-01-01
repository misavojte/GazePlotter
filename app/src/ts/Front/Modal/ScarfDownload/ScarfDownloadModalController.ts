import { AbstractModalController } from '../AbstractModalController'
import { ScarfDownloadModalModel } from './ScarfDownloadModalModel'

export class ScarfDownloadModalController extends AbstractModalController {
  model: ScarfDownloadModalModel
  constructor (model: ScarfDownloadModalModel) {
    super()
    this.model = model
  }

  handleSubmitEvent (e: Event): void {
    const target = e.target as HTMLFormElement
    const formData = new FormData(target)
    const fileName = formData.get('file_name') as string
    const fileType = formData.get('file_type') as string
    const width = formData.get('width') as string
    const scarf = document.getElementsByClassName('chartwrap')[this.model.scarfId]
    if (!(scarf instanceof HTMLElement)) throw new Error('ScarfDownloadModalController.handleSubmitEvent() - scarf not HTMLElement')
    this.model.downloadScarf(fileName, fileType, width, scarf)
  }
}
