import { ScarfTooltipModel } from './ScarfTooltipModel'
import { AbstractController } from '../Common/AbstractController'

export class ScarfTooltipController extends AbstractController {
  model: ScarfTooltipModel
  constructor (model: ScarfTooltipModel) {
    super()
    this.model = model
  }

  /** No event handling needed for this controller. */
  handleEvent (e: Event): void {
    console.warn('ScarfTooltipController.handleEvent() not implemented', e)
  }
}
