import { AbstractModalView } from '../AbstractModalView'
import { AoiSettingsModalController } from './AoiSettingsModalController'

export class AoiSettingsModalView extends AbstractModalView {
  controller: AoiSettingsModalController
  bodyHtml: string
  constructor (controller: AoiSettingsModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    return ''
  }
}
