import { AbstractController } from '../Common/AbstractController'
import { WorkplaceModel } from './WorkplaceModel'

export class WorkplaceController extends AbstractController {
  model: WorkplaceModel

  constructor (model: WorkplaceModel) {
    super()
    this.model = model
  }

  /**
   * Fire according event type handler. These type handlers should be customized to do expected actions.
   * @param e - Event passed from event listener in AbstractView
   */
  handleEvent (e: Event): void {
    e.stopPropagation()
    if (this.model.isCrashed) return
    switch (e.type) {
      case 'click' :
        return this.handleClick(e)
    }
  }

  handleClick (e: Event): void {
    const target = e.target as HTMLElement
    switch (target.id) {
      case 'save-workplace' : return this.model.openWorkplaceModal()
      case 'save-scan-graph' : return this.model.initScanGraphDownloadModal()
    }
  }
}