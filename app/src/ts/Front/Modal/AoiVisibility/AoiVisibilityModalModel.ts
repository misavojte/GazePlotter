import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'

export class AoiVisibilityModalModel extends AbstractModalModel {
  scarfId: number
  stimulusId: number
  constructor (workplace: WorkplaceModel, stimulusId: number, scarfId: number) {
    super(workplace, 'Scarf Chart Settings')
    this.stimulusId = stimulusId
    this.scarfId = scarfId
  }

  fireAddInfo (file: File): void {
    console.log('AoiVisibilityModalModel.fireAddInfo()', file)
  }
}
