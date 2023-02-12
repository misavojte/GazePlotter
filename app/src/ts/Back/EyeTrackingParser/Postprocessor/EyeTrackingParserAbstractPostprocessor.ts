import { ETDInterface } from '../../../Data/EyeTrackingData'

export abstract class EyeTrackingParserAbstractPostprocessor {
  abstract process (data: ETDInterface): ETDInterface

  orderAoisAlphabetically (data: ETDInterface): void {
    const aois = data.aois
    for (let i = 0; i < aois.data.length; i++) {
      const aoi = aois.data[i]
      const orderVector: number[] = []
      aoi.sort((a, b) => a[0].localeCompare(b[0])).forEach((_, index) => orderVector.push(index))
      aois.orderVector[i] = orderVector
    }
  }

  orderParticipantsAlphabetically (data: ETDInterface): void {
    const participants = data.participants
    const orderVector: number[] = []
    participants.data.sort((a, b) => a[0].localeCompare(b[0])).forEach((_, index) => orderVector.push(index))
    participants.orderVector = orderVector
  }
}
