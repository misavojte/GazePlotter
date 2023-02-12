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

  fireUpdateAoi (aoiIds: number[], displayedNames: string[], colors: string[], applyColor: string): void {
    this.data.setAoiOrder(this.stimulusId, aoiIds)
    const numberOfAois = aoiIds.length
    for (let i = 0; i < numberOfAois; i++) {
      const aoiId = aoiIds[i]
      const displayedName = displayedNames[i]
      const color = colors[i]
      this.data.setAoiName(this.stimulusId, aoiId, displayedName)
      this.data.setAoiColor(this.stimulusId, aoiId, color)
      if (applyColor === 'by_displayed_name') {
        this.modifyAllAoisColorByName(null, displayedName, color)
      } else if (applyColor === 'by_original_name') {
        this.modifyAllAoisColorByName(this.data.getAoiInfo(this.stimulusId, aoiId).originalName, null, color)
      }
    }
    this.addFlash('AOIs updated', 'info')
    this.notify('redraw', ['workplaceModel'])
    this.fireClose()
  }

  modifyAllAoisColorByName (originalName: string | null, displayedName: string | null, color: string): void {
    const noOfStimuli = this.data.noOfStimuli
    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      const aois = this.data.getAoiOrderArray(stimulusId)
      for (const aoi of aois) {
        const aoiInfo = this.data.getAoiInfo(stimulusId, aoi)
        if (aoiInfo.displayedName === displayedName) {
          this.data.setAoiColor(stimulusId, aoi, color)
        }
        if (aoiInfo.originalName === originalName) {
          this.data.setAoiColor(stimulusId, aoi, color)
        }
      }
    }
  }
}
