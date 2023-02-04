import { AbstractModalView } from '../AbstractModalView'
import { TobiiUploadModalController } from './TobiiUploadModalController'

export class TobiiUploadModalView extends AbstractModalView {
  bodyHtml: string

  controller: TobiiUploadModalController
  constructor (controller: TobiiUploadModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.#printBodyHtml()
  }

  #printBodyHtml (): string {
    return `
    <form class="js-submit">
        <div>
            <label for="stimuli_parsing_default">Default by media column</label>
            <input type="radio" name="stimuli_parsing" value="default" id="stimuli_parsing_default" checked>
        </div>
        <div>
            <label for="stimuli_parsing_event">By timeline events in event column</label>
            <input type="radio" name="stimuli_parsing" value="event" id="stimuli_parsing_event">
        </div>
        <input type="submit" value="Confirm parsing">   
    </form>
    `
  }
}
