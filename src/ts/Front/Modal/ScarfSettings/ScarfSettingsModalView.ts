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
    const fieldsetsHtml = this.controller.model.timelines.map(type => this.#printTimelineFieldset(type)).join('')
    return `
    <div class="button-group">
        <button class="btn4 js-click" data-modal="aoi-settings">AOIs Settings</button>
        <button class="btn4 js-click" data-modal="aoi-visibility">AOIs Visibility</button>
    </div>
    <form class="js-submit">
        ${fieldsetsHtml}
        <input type="submit" value="Confirm changes">  
    </form>
    `
  }

  #printTimelineFieldset (timelineType: 'absolute' | 'ordinal'): string {
    const typeLastVal = this.controller.model[`${timelineType}LastVal`]
    const title = timelineType === 'absolute' ? 'Absolute timeline [ms] settings' : 'Ordinal timeline [indices] settings'
    return `
    <fieldset>
      <legend>${title}</legend>
    <div style="margin-bottom:7px">
    <label>
      <input type="radio" name="${timelineType}_timeline_apply" value="this" checked>
    This stimulus
    </label>
    <label>
    <input type="radio" name="${timelineType}_timeline_apply" value="all">
      All stimuli
    </label>
    </div>
    <label class="flex-row">
      Last chart value (0 = auto)
    <input type="number" name="${timelineType}_timeline_last_val" value="${typeLastVal}" min="0" step="1">
      </label>
      </fieldset>`
  }
}
