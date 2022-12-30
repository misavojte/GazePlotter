import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'

export class ScarfDownloadModalModel extends AbstractModalModel {
  constructor (workplace: WorkplaceModel) {
    super(workplace, 'Scarf Chart Settings')
  }
}
