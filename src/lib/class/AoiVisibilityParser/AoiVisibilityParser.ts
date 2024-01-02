import { getStimulusHighestEndTime, updateMultipleAoiVisibility } from '$lib/stores/dataStore.ts'

export class AoiVisibilityParser {
  addVisInfo (stimulusId: number, participantId: number | null, xml: Document): void {
    const aoiNodes = xml.getElementsByTagName('DynamicAOI')
    const multipleAoiNames: string[] = []
    const multipleAoiVisibilityArrays: number[][] = []
    for (let i = 0; i < aoiNodes.length; i++) {
      const aoiName = aoiNodes[i].querySelector('Name')?.innerHTML
      if (aoiName === undefined) continue
      const aoiKeyFrames = aoiNodes[i].getElementsByTagName('KeyFrame')
      const aoiVisibilityArr = this.processKeyFrames(aoiKeyFrames, stimulusId)
      multipleAoiNames.push(aoiName)
      multipleAoiVisibilityArrays.push(aoiVisibilityArr)
    }
    updateMultipleAoiVisibility(stimulusId, multipleAoiNames, multipleAoiVisibilityArrays, participantId)
  }

  processKeyFrames (keyFrames: HTMLCollectionOf<Element>, stimulusId: number): number[] {
    const visibilityArr = []
    let isAoiCurrentlyVisible = false
    for (let i = 0; i < keyFrames.length; i++) {
      const frame = keyFrames[i]
      const visibility = frame.querySelector('Visible')?.innerHTML
      if (visibility === undefined) continue
      if (visibility === 'true' && !isAoiCurrentlyVisible) {
        const timestampNode = frame.querySelector('Timestamp')
        if (timestampNode === null) continue
        const timestamp = Number(timestampNode.innerHTML) / 1000 // ms
        visibilityArr.push(timestamp)
        isAoiCurrentlyVisible = true
      }
      if ((visibility === 'false' && isAoiCurrentlyVisible)) {
        const timestampNode = frame.querySelector('Timestamp')
        if (timestampNode === null) continue
        const timestamp = Number(timestampNode.innerHTML) / 1000 // ms
        visibilityArr.push(timestamp)
        isAoiCurrentlyVisible = false
      }
      if ((visibility === 'true' && i === keyFrames.length - 1)) {
        const timestamp = getStimulusHighestEndTime(stimulusId)
        visibilityArr.push(timestamp)
        isAoiCurrentlyVisible = false
      }
    }
    return visibilityArr
  }
}
