import { AbstractModalView } from '../AbstractModalView'
import { ScarfSettingsModalController } from './ScarfSettingsModalController'

export class ScarfSettingsModalView extends AbstractModalView {
  controller: ScarfSettingsModalController
  bodyHtml: string
  constructor (controller: ScarfSettingsModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    const model = this.controller.model
    return `
    <div class="button-group">
        <button class="btn4 js-click" data-modal="aoi-settings">AOIs Settings</button>
        <button class="btn4 js-click" data-modal="aoi-visibility">AOIs Visibility</button>
    </div>
    <form class="js-submit">
        <fieldset>
            <legend>X axis width [ms]</legend>
            <div style="margin-bottom:7px">
            <label>
                <input type="radio" name="x_axis_width_apply" value="this" checked>
                This stimulus
            </label>
            <label>
                <input type="radio" name="x_axis_width_apply" value="all">
                All stimuli
            </label>
            </div>
            <label class="flex-row">
                Value (0 = auto width)
                <input type="number" name="x_axis_width_value" value="${model.width}" min="0" step="1">
            </label>
        </fieldset>
        <input type="submit" value="Confirm changes">  
    </form>
    `
  }
}
