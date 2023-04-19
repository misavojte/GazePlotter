import { AbstractController } from '../Common/AbstractController'
import { StartButtonsModel } from './StartButtonsModel'

export class StartButtonsController extends AbstractController {
  model: StartButtonsModel

  constructor (model: StartButtonsModel) {
    super()
    this.model = model
  }

  handleEvent (e: Event): void {
    e.stopPropagation()
    switch (e.type) {
      case 'click' :
        return this.handleDemoClick()
      case 'change' :
        this.handleChangeEvent(e)
    }
  }

  handleDemoClick (): void {
    if (!this.model.isProcessing) this.model.startDemo()
  }

  handleChangeEvent (e: Event): void {
    if (!(e.target instanceof HTMLInputElement)) return
    const files = e.target.files
    if (files !== null) this.model.startNewFile(files)
  }
}
