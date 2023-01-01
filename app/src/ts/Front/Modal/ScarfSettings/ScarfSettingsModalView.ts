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
    return `
    <button class="btn4 js-click" data-modal="aoi-settings">AOIs Settings</button>
    <button class="btn4 js-click" data-modal="aoi-visibility">AOIs Visibility</button>
    `
  }
}
