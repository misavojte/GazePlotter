import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'

export class ScarfSettingsModalModel extends AbstractModalModel {
  stimulusId: number
  scarfId: number
  constructor (workplace: WorkplaceModel, stimulusId: number, scarfId: number) {
    super(workplace, 'Scarf Chart Settings')
    this.stimulusId = stimulusId
    this.scarfId = scarfId
  }

  openAoiSettingsModal (): void {
    this.isRequestingModal = true
    this.notify('open-aoi-settings-modal', ['workplaceModel'])
  }

  openAoiVisibilityModal (): void {
    this.isRequestingModal = true
    this.notify('open-aoi-visibility-modal', ['workplaceModel'])
  }
}
