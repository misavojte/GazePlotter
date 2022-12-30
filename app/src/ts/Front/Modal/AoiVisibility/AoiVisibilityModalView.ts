import { AbstractModalView } from '../AbstractModalView'
import { AoiVisibilityModalController } from './AoiVisibilityModalController'

export class AoiVisibilityModalView extends AbstractModalView {
  controller: AoiVisibilityModalController
  bodyHtml: string
  constructor (controller: AoiVisibilityModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    return ''
  }
}
