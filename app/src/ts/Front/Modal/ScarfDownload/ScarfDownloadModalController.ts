import { AbstractModalController } from '../AbstractModalController'
import { ScarfDownloadModalModel } from './ScarfDownloadModalModel'

export class ScarfDownloadModalController extends AbstractModalController {
  model: ScarfDownloadModalModel
  constructor (model: ScarfDownloadModalModel) {
    super()
    this.model = model
  }
}
