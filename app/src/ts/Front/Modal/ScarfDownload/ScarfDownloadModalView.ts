import { AbstractModalView } from '../AbstractModalView'
import { ScarfDownloadModalController } from './ScarfDownloadModalController'

export class ScarfDownloadModalView extends AbstractModalView {
  controller: ScarfDownloadModalController
  bodyHtml: string
  constructor (controller: ScarfDownloadModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    return ''
  }
}
