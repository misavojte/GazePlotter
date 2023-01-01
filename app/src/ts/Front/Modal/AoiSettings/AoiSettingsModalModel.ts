import { AbstractModalModel } from '../AbstractModalModel'
import { WorkplaceModel } from '../../Workplace/WorkplaceModel'

export class AoiSettingsModalModel extends AbstractModalModel {
  stimulusId: number
  constructor (workplace: WorkplaceModel, stimulusId: number) {
    super(workplace, 'AOIs Settings')
    this.stimulusId = stimulusId
  }

  getAoisInfo (): Array<{ originalName: string, color: string, displayedName: string, aoiId: number }> {
    const aois = this.data.getAoiOrderArray(this.stimulusId)
    return aois.map((aoiId) => {
      return this.data.getAoiInfo(this.stimulusId, aoiId)
    })
  }

  fireUpdateAoi (aoiId: number[], displayedName: string[], color: string[]): void {
    this.data.setAoiOrder(this.stimulusId, aoiId)
    const numberOfAois = aoiId.length
    for (let i = 0; i < numberOfAois; i++) {
      this.data.setAoiName(this.stimulusId, aoiId[i], displayedName[i])
      this.data.setAoiColor(this.stimulusId, aoiId[i], color[i])
    }
    this.addFlash('AOIs updated', 'info')
    this.notify('redraw', ['workplaceModel'])
    this.fireClose()
  }
}
