import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'
import { ScarfSettingsType } from '../../../Types/Scarf/ScarfSettingsType'

export class ScarfSettingsModalModel extends AbstractModalModel {
  stimulusId: number
  scarfId: number
  scarfSettings: ScarfSettingsType
  timelines: Array<'absolute' | 'ordinal'>
  get absoluteLastVal (): number {
    return this.scarfSettings.absoluteStimuliLastVal[this.stimulusId] ?? this.scarfSettings.absoluteGeneralLastVal
  }

  get ordinalLastVal (): number {
    return this.scarfSettings.ordinalStimuliLastVal[this.stimulusId] ?? this.scarfSettings.ordinalGeneralLastVal
  }

  constructor (workplace: WorkplaceModel, settings: ScarfSettingsType, stimulusId: number, scarfId: number) {
    super(workplace, 'Scarf Chart Settings')
    this.stimulusId = stimulusId
    this.scarfId = scarfId
    this.scarfSettings = settings
    const data = workplace.data
    if (data === null) throw new Error('ScarfSettingsModalModel.constructor() - workplace.data is null')
    this.timelines = data.main.isOrdinalOnly ? ['ordinal'] : ['absolute', 'ordinal']
  }

  openAoiSettingsModal (): void {
    this.isRequestingModal = true
    this.notify('open-aoi-settings-modal', ['workplaceModel'])
  }

  openAoiVisibilityModal (): void {
    this.isRequestingModal = true
    this.notify('open-aoi-visibility-modal', ['workplaceModel'])
  }

  modifyTimelineSettings (timeline: 'absolute' | 'ordinal', lastVal: number, applyToAll: boolean): void {
    if (applyToAll) {
      this.scarfSettings[`${timeline}GeneralLastVal`] = lastVal
      this.scarfSettings[`${timeline}StimuliLastVal`] = []
    } else {
      this.scarfSettings[`${timeline}StimuliLastVal`][this.stimulusId] = lastVal
    }
  }

  fireRedraw (): void {
    this.notify('redraw', ['workplaceModel'])
    this.fireClose()
  }
}
