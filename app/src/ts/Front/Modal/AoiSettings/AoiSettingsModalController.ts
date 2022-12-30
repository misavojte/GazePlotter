import { AbstractModalController } from '../AbstractModalController'
import { AoiSettingsModalModel } from './AoiSettingsModalModel'

export class AoiSettingsModalController extends AbstractModalController {
  model: AoiSettingsModalModel
  constructor (model: AoiSettingsModalModel) {
    super()
    this.model = model
  }
}
