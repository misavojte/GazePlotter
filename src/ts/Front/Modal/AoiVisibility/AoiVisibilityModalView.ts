import { AbstractModalView } from '../AbstractModalView'
import { AoiVisibilityModalController } from './AoiVisibilityModalController'

export class AoiVisibilityModalView extends AbstractModalView {
  controller: AoiVisibilityModalController
  bodyHtml: string
  constructor (controller: AoiVisibilityModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    return `
    <form class="js-submit">
        <div>
            Upload XML file containing AOIs visibility information. Only for SMI!
        </div>
        <fieldset>
            <legend>Dynamic AOI visibility for current stimulus</legend>
            <label class="flex-row">XML File
                <input type="file" name="file">
            </label>
            <label class="flex-row">
                Apply to participant
                <select name="participantId">
                    ${this.controller.model.participantOptions.map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}
                </select>
            </label>
        </fieldset>
        <input type="submit" value="Start Parsing">  
    </form>
    `
  }
}
