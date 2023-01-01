import { AbstractModalView } from '../AbstractModalView'
import { ScarfDownloadModalController } from './ScarfDownloadModalController'

export class ScarfDownloadModalView extends AbstractModalView {
  controller: ScarfDownloadModalController
  bodyHtml: string
  constructor (controller: ScarfDownloadModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    return `
    <form class="js-submit">
        <div>
            <label for="width">Width of the plot in px</label>
            <input type="number" name="width" value="800">
        </div>
         <div>
            <label for="file_name">File name</label>
            <input type="text" name="file_name" value="scarf-export">
        </div>
        <div>
            <label for="file_type">File extension</label>
            <select name="file_type">
              <option selected value=".svg">.svg</option>
              <option value=".png">.png</option>
              <option value=".jpg">.jpg</option>
              <option value=".webp">.webp</option>
            </select>
        </div>
        <input type="submit" value="Start Download">   
    </form>
    `
  }
}
