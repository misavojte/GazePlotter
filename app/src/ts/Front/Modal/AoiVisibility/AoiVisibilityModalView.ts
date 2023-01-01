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
        <div>
            <label for="file">File containing information</label>
            <input type="file" name="file">
        </div>
        <input type="submit" value="Start Parsing">  
    </form>
    `
  }
}
