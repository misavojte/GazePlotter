import { ETDInterface } from '../../../Data/EyeTrackingData'

export abstract class EyeTrackingParserAbstractPostprocessor {
  abstract process (data: ETDInterface): ETDInterface

  orderAoisAlphabetically (data: ETDInterface): void {
    const aois = data.aois
    for (let i = 0; i < aois.data.length; i++) {
      const currentAoiArray = aois.data[i]
      const indexedArr = currentAoiArray.map((value, index) => ({ index, name: value[0] }))
      indexedArr.sort((a, b) => a.name.localeCompare(b.name))
      const sortedIndices = indexedArr.map((value) => value.index)
      aois.orderVector[i] = sortedIndices
    }
  }

  orderParticipantsAlphabetically (data: ETDInterface): void {
    const participants = data.participants
    const indexedArr = participants.data.map((value, index) => ({ index, name: value[0] }))
    indexedArr.sort((a, b) => a.name.localeCompare(b.name))
    const sortedIndices = indexedArr.map((value) => value.index)
    participants.orderVector = sortedIndices
  }
}
