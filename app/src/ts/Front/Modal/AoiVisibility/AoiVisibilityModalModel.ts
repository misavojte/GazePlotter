import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'
import { AoiVisibilityParser } from '../../../Back/AoiVisibilityParser/AoiVisibilityParser'
import { ScarfSettingsType } from '../../../Types/Scarf/ScarfSettingsType'

export class AoiVisibilityModalModel extends AbstractModalModel {
  settings: ScarfSettingsType
  stimulusId: number
  constructor (workplace: WorkplaceModel, stimulusId: number, settings: ScarfSettingsType) {
    super(workplace, 'Scarf Chart Settings')
    this.stimulusId = stimulusId
    this.settings = settings
  }

  fireAddInfo (file: File): void {
    console.log('AoiVisibilityModalModel.fireAddInfo()', file)
    const fileType = file.name.split('.').pop()
    if (fileType !== 'xml') return
    void file.text().then(x => {
      const parser = new DOMParser()
      const xml = parser.parseFromString(x, 'application/xml')
      new AoiVisibilityParser().addVisInfo(this.stimulusId, xml, this.data)
      this.settings.aoiVisibility = true
      this.notify('redraw', ['workplaceModel'])
      this.fireClose()
    })
  }
}
