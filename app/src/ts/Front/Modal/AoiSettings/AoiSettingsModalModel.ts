import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'

export class AoiSettingsModalModel extends AbstractModalModel {
  constructor (workplace: WorkplaceModel) {
    super(workplace, 'AOIs Settings')
  }
}
