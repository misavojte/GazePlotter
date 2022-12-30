import { AbstractModalController } from '../AbstractModalController'
import { ScarfSettingsModalModel } from './ScarfSettingsModalModel'

export class ScarfSettingsModalController extends AbstractModalController {
  model: ScarfSettingsModalModel
  constructor (model: ScarfSettingsModalModel) {
    super()
    this.model = model
  }
}
