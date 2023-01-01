import { AbstractModalView } from '../AbstractModalView'
import { AoiSettingsModalController } from './AoiSettingsModalController'

export class AoiSettingsModalView extends AbstractModalView {
  controller: AoiSettingsModalController
  bodyHtml: string
  constructor (controller: AoiSettingsModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    const aoisInfo = this.controller.model.getAoisInfo()
    return `
    <div class='gr-line'>
       <div>Original name</div>
       <div>Displayed name</div>
       <div>Color</div>
       <div>Order</div>
    </div>
    <form class="js-submit">
      <div>
      ${aoisInfo.map((aoi) => {
return `
      <div class='gr-line'>
        <div>${aoi.originalName}</div>
        <input name='displayed_name' type='text' value='${aoi.displayedName}'>
        <input name='color' type='color' value='${aoi.color}'>
        <input name='aoi_id' type='hidden' value='${aoi.aoiId}'>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi bi-arrow-up-short" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"/>
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi bi-arrow-down-short" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z"/>
        </svg>
      </div>`
      }).join('')}
      </div>
      <input type="submit" value="Apply changes">   
    </form>`
  }
}
