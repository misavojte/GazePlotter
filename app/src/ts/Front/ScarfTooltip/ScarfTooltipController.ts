import { ScarfTooltipModel } from './ScarfTooltipModel'

export class ScarfTooltipController {
  model: ScarfTooltipModel
  constructor (model: ScarfTooltipModel) {
    this.model = model
  }

  handleEvent (e: Event): void {
    e.stopPropagation()
    switch (e.type) {
      case 'mouseleave' : return this.model.hide()
    }
  }
}
