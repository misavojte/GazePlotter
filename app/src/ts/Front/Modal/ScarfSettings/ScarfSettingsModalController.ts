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
    const applyToAll = form.x_axis_width_apply.value === 'all'
    const width = Number(form.x_axis_width_value.value)
    if (width < 0) throw new Error('Width cannot be negative')
    this.model.fireWidthChange(width, applyToAll)
  }
}
