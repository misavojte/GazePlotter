import { EyeTrackingData } from '../../Data/EyeTrackingData'

export class AoiVisibilityParser {
  addVisInfo (stimulusId: number, xml: Document, data: EyeTrackingData): void {
    const aoiNodes = xml.getElementsByTagName('DynamicAOI')
    for (let i = 0; i < aoiNodes.length; i++) {
      const aoiName = aoiNodes[i].querySelector('Name')?.innerHTML
      if (aoiName === undefined) continue
      const aoiKeyFrames = aoiNodes[i].getElementsByTagName('KeyFrame')
      const aoiVisibilityArr = this.processKeyFrames(aoiKeyFrames, stimulusId, data)
      data.addAoiVis(stimulusId, aoiName, aoiVisibilityArr)
      console.log(data)
    }
  }

  processKeyFrames (keyFrames: HTMLCollectionOf<Element>, stimulusId: number, data: EyeTrackingData): number[] {
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
        const timestamp = data.getStimulHighestEndTime(stimulusId)
        visibilityArr.push(timestamp)
        isAoiCurrentlyVisible = false
      }
    }
    return visibilityArr
  }
}
