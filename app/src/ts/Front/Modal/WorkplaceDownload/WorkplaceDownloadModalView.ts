import { AbstractModalView } from '../AbstractModalView'
import { WorkplaceDownloadModalController } from './WorkplaceDownloadModalController'

export class WorkplaceDownloadModalView extends AbstractModalView {
  bodyHtml: string
  controller: WorkplaceDownloadModalController

  constructor (controller: WorkplaceDownloadModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.#printBodyHtml()
  }

  #printBodyHtml (): string {
    return `
    <form class="js-submit">
        <div>
            <label for="file_name">File name</label>
            <input type="text" name="file_name" value="scarf-export">
        </div>
        <input type="submit" value="Start Download">   
    </form>
    `
  }
}
