import { AbstractModalController } from '../AbstractModalController'
import { ScarfSettingsModalModel } from './ScarfSettingsModalModel'

export class ScarfSettingsModalController extends AbstractModalController {
  model: ScarfSettingsModalModel
  constructor (model: ScarfSettingsModalModel) {
    super()
    this.model = model
  }

  handleOtherClickEvent (e: Event): void {
    const target = e.target as HTMLElement
    switch (target.dataset.modal) {
      case 'aoi-settings':
        return this.model.openAoiSettingsModal()
      case 'aoi-visibility':
        return this.model.openAoiVisibilityModal()
    }
  }
}
