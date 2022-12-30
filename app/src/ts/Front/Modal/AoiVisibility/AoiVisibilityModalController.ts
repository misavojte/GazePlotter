import { AbstractModalController } from '../AbstractModalController'
import { AoiVisibilityModalModel } from './AoiVisibilityModalModel'

export class AoiVisibilityModalController extends AbstractModalController {
  model: AoiVisibilityModalModel
  constructor (model: AoiVisibilityModalModel) {
    super()
    this.model = model
  }
}
