import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'
import { ScarfSettingsType } from '../../../Types/Scarf/ScarfSettingsType'

export class ScarfSettingsModalModel extends AbstractModalModel {
  stimulusId: number
  scarfId: number
  scarfSettings: ScarfSettingsType
  get width (): number {
    return this.scarfSettings.stimuliWidth[this.stimulusId] ?? this.scarfSettings.generalWidth
  }

  constructor (workplace: WorkplaceModel, settings: ScarfSettingsType, stimulusId: number, scarfId: number) {
    super(workplace, 'Scarf Chart Settings')
    this.stimulusId = stimulusId
    this.scarfId = scarfId
    this.scarfSettings = settings
  }

  openAoiSettingsModal (): void {
    this.isRequestingModal = true
    this.notify('open-aoi-settings-modal', ['workplaceModel'])
  }

  openAoiVisibilityModal (): void {
    this.isRequestingModal = true
    this.notify('open-aoi-visibility-modal', ['workplaceModel'])
  }

  fireWidthChange (width: number, applyToAll: boolean): void {
    if (applyToAll) {
      this.scarfSettings.generalWidth = width
      this.scarfSettings.stimuliWidth = []
    } else {
      this.scarfSettings.stimuliWidth[this.stimulusId] = width
    }
    this.notify('redraw', ['workplaceModel'])
    this.fireClose()
  }
}
