import { AbstractModalController } from '../AbstractModalController'
import { ScarfSettingsModalModel } from './ScarfSettingsModalModel'

export class ScarfSettingsModalController extends AbstractModalController {
  model: ScarfSettingsModalModel
  constructor (model: ScarfSettingsModalModel) {
    super()
    this.model = model
  }

  handleOtherClickEvent (e: Event): void {
    const target = e.target as HTMLElement
    switch (target.dataset.modal) {
      case 'aoi-settings':
        return this.model.openAoiSettingsModal()
      case 'aoi-visibility':
        return this.model.openAoiVisibilityModal()
    }
  }

  handleSubmitEvent (e: Event): void {
    const form = e.target as HTMLFormElement
    const types = this.model.timelines
    for (const type of types) {
      this.#handleTimelineChange(form, type)
    }
    this.model.fireRedraw()
  }

  #handleTimelineChange (form: HTMLFormElement, timelineType: 'absolute' | 'ordinal'): void {
    const applyToAll = form[`${timelineType}_timeline_apply`].value === 'all'
    const width = parseInt(form[`${timelineType}_timeline_last_val`].value)
    this.model.modifyTimelineSettings(timelineType, width, applyToAll)
  }
}
