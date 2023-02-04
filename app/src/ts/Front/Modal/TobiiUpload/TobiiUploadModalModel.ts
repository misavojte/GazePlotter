import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'

export class TobiiUploadModalModel extends AbstractModalModel {
  parsingType: 'default' | 'event' = 'default'
  constructor (workplace: WorkplaceModel) {
    super(workplace, 'Tobii Upload')
  }

  fireUpload (parsingType: 'default' | 'event'): void {
    this.parsingType = parsingType
    this.addFlash('Tobii parsing settings accepted', 'info')
    this.fireClose() // on closing will notify startButtonsModel as well which will proceed with upload
  }
}
