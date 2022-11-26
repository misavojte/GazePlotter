import { AbstractPublisher } from '../Common/AbstractPublisher'
import { AbstractModel } from '../Common/AbstractModel'
import { WorkplaceModel } from '../Workplace/WorkplaceModel'

export abstract class AbstractModalModel extends AbstractPublisher implements AbstractModel {
  workplaceModel: WorkplaceModel

  protected constructor (workplaceModel: WorkplaceModel) {
    super()
    this.workplaceModel = workplaceModel
  }
}
