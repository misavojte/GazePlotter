import { AbstractModalView } from '../AbstractModalView'
import { ScarfSettingsModalController } from './ScarfSettingsModalController'

export class ScarfSettingsModalView extends AbstractModalView {
  controller: ScarfSettingsModalController
  bodyHtml: string
  constructor (controller: ScarfSettingsModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    return ''
  }
}
