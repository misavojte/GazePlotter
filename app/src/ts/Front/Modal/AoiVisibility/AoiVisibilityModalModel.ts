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

  get participantOptions (): Array<[number, string]> {
    const options: Array<[number, string]> = []
    options.push([-1, 'All'])
    for (let participantId = 0; participantId < this.data.noOfParticipants; participantId++) {
      options.push([participantId, this.data.getParticName(participantId)])
    }
    return options
  }

  fireAddInfo (file: File, participantId: number | null): void {
    const fileType = file.name.split('.').pop()
    if (fileType !== 'xml') {
      this.addFlash('Not .xml file', 'error')
      return
    }
    void file.text().then(x => {
      const parser = new DOMParser()
      const xml = parser.parseFromString(x, 'application/xml')
      new AoiVisibilityParser().addVisInfo(this.stimulusId, participantId, xml, this.data)
      this.settings.aoiVisibility = true
      this.notify('redraw', ['workplaceModel'])
      this.addFlash('AOI visibility info added', 'success')
    }).catch(e => {
      console.error(e)
      this.addFlash('Error while adding AOI visibility info', 'error')
    })
  }
}
