import { ControllerInterface } from '../Common/ControllerInterface'
import { StartButtonsModel } from './StartButtonsModel'

export class StartButtonsController implements ControllerInterface {
  model: StartButtonsModel

  constructor (model: StartButtonsModel) {
    this.model = model
  }

  // handleChangeEvent(e: Event) {
  //     const files = (<HTMLInputElement>e.target).files;
  //     if (files !== null) this.postUpdate('newFile', files);
  // }

  handleEvent (e: Event): void {
    e.stopPropagation()
    switch (e.type) {
      case 'click' :
        this.model.startDemo()
    }
  }
}
