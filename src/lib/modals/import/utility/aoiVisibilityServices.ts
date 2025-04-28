/**
 * Service functions for processing AOI visibility data
 * @category Services
 * @module services/aoiVisibilityServices
 */
import {
  getStimulusHighestEndTime,
  updateMultipleAoiVisibility,
} from '$lib/gaze-data/front-process/stores/dataStore'

/**
 * Main function to process the AOI visibility data
 * @param stimulusId id of the stimulus to which the AOIs belong
 * @param participantId id of the participant to which the AOIs belong (null if not participant-specific and should be applied to all participants)
 * @param files list of files to process
 * @param callback callback function to update the AOI visibility in the store (is parameterized for testing purposes)
 */
export const processAoiVisibility = async (
  stimulusId: number,
  participantId: number | null,
  files: FileList,
  callback: (
    stimulusId: number,
    multipleAoiNames: string[],
    multipleAoiVisibilityArrays: number[][],
    participantId: number | null
  ) => void = updateMultipleAoiVisibility
): Promise<void> => {
  // Read the file (only one file is expected)
  files[0].text().then(text => {
    const parser = new DOMParser()
    const xml = parser.parseFromString(text, 'application/xml')
    const data = processSmi(stimulusId, participantId, xml)
    callback(
      data.stimulusId,
      data.multipleAoiNames,
      data.multipleAoiVisibilityArrays,
      data.participantId
    )
  })
  const text = await files[0].text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')
  if (xml.getElementsByTagName('DynamicAOI').length === 0) {
    // Tobii AOI visibility file
    // Parse as JSON instead of XML
    const tobiiJson = JSON.parse(text)

    if (!isTobiiJson(tobiiJson)) {
      console.warn(tobiiJson)
      throw new Error('Assumed Tobii JSON format, but it is not valid')
    }

    const data = processTobii(stimulusId, participantId, tobiiJson)
    callback(
      data.stimulusId,
      data.multipleAoiNames,
      data.multipleAoiVisibilityArrays,
      data.participantId
    )
  } else {
    const data = processSmi(stimulusId, participantId, xml)
    callback(
      data.stimulusId,
      data.multipleAoiNames,
      data.multipleAoiVisibilityArrays,
      data.participantId
    )
  }
}

/**
 * Process the dynamic AOIs SMI XML data and update the AOI visibility in the store
 * @param stimulusId id of the stimulus to which the AOIs belong
 * @param participantId id of the participant to which the AOIs belong (null if not participant-specific and should be applied to all participants)
 * @returns data for the processAoiVisibility callback function
 */
export const processSmi = (
  stimulusId: number,
  participantId: number | null,
  xml: Document
): {
  stimulusId: number
  multipleAoiNames: string[]
  multipleAoiVisibilityArrays: number[][]
  participantId: number | null
} => {
  const aoiNodes = xml.getElementsByTagName('DynamicAOI')
  const multipleAoiNames: string[] = []
  const multipleAoiVisibilityArrays: number[][] = []
  for (let i = 0; i < aoiNodes.length; i++) {
    const aoiName = aoiNodes[i].querySelector('Name')?.innerHTML
    if (aoiName === undefined) continue
    const aoiKeyFrames = aoiNodes[i].getElementsByTagName('KeyFrame')
    const aoiVisibilityArr = processSmiKeyFrames(aoiKeyFrames, stimulusId)
    multipleAoiNames.push(aoiName)
    multipleAoiVisibilityArrays.push(aoiVisibilityArr)
  }
  return {
    stimulusId,
    multipleAoiNames,
    multipleAoiVisibilityArrays,
    participantId,
  }
}

/**
 * Process the keyframes of a dynamic AOI in SMI XML data
 * @param keyFrames keyframes of the dynamic AOI
 * @param stimulusId id of the stimulus to which the AOI belongs
 * @returns an array of timestamps when the AOI is visible
 */
export const processSmiKeyFrames = (
  keyFrames: HTMLCollectionOf<Element>,
  stimulusId: number
): number[] => {
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
    if (visibility === 'false' && isAoiCurrentlyVisible) {
      const timestampNode = frame.querySelector('Timestamp')
      if (timestampNode === null) continue
      const timestamp = Number(timestampNode.innerHTML) / 1000 // ms
      visibilityArr.push(timestamp)
      isAoiCurrentlyVisible = false
    }
    if (visibility === 'true' && i === keyFrames.length - 1) {
      const timestamp = getStimulusHighestEndTime(stimulusId)
      visibilityArr.push(timestamp)
      isAoiCurrentlyVisible = false
    }
  }
  return visibilityArr
}

/**
 * Input Tobii JSON format
 */
type TobiiJson = {
  Tags: unknown[]
  Media: {
    MediaType: number
    Height: number
    Width: number
    MediaCount: number
    DurationMicroseconds: number
  }
  Version: number
  Aois: Record<
    number,
    {
      Red: number
      Green: number
      Blue: number
      Name: string
      Tags: unknown[]
      KeyFrames: Record<
        number,
        {
          IsActive: boolean
          Seconds: number
          Vertices: unknown
        }
      >
    }
  >
}

/**
 * Check if the JSON is in the correct Tobii format
 * @param json JSON data to check
 * @returns true if the JSON is in the correct Tobii format, false otherwise
 */
export const isTobiiJson = (json: unknown): json is TobiiJson => {
  if (typeof json !== 'object') return false
  if (json === null) return false
  if (!('Aois' in json)) return false

  // Type assertion to inform TypeScript that json['Aois'] is an object
  const aois = json['Aois'] as Record<string, unknown>
  if (
    typeof aois !== 'object' ||
    aois === null ||
    Object.keys(aois).length === 0
  )
    return false

  const firstAoiKey = Object.keys(aois)[0]
  // Type assertion to inform TypeScript that aois[firstAoiKey] is an object
  const firstAoi = aois[firstAoiKey] as Record<string, unknown>
  if (!('KeyFrames' in firstAoi)) return false

  // Type assertion to inform TypeScript that firstAoi['KeyFrames'] is an object
  const keyFrames = firstAoi['KeyFrames'] as Record<string, unknown>
  if (
    typeof keyFrames !== 'object' ||
    keyFrames === null ||
    Object.keys(keyFrames).length === 0
  )
    return false

  const firstKeyFrameKey = Object.keys(keyFrames)[0]
  // Type assertion to inform TypeScript that keyFrames[firstKeyFrameKey] is an object
  const firstKeyFrame = keyFrames[firstKeyFrameKey] as Record<string, unknown>
  if (!('IsActive' in firstKeyFrame)) return false
  if (!('Seconds' in firstKeyFrame)) return false

  return true
}

/**
 * Process the Tobii AOI visibility data and update the AOI visibility in the store
 * @param stimulusId id of the stimulus to which the AOIs belong
 * @param participantId id of the participant to which the AOIs belong (null if not participant-specific and should be applied to all participants)
 * @returns data for the processAoiVisibility callback function
 */
export const processTobii = (
  stimulusId: number,
  participantId: number | null,
  tobiiJson: TobiiJson
): {
  stimulusId: number
  multipleAoiNames: string[]
  multipleAoiVisibilityArrays: number[][]
  participantId: number | null
} => {
  const multipleAoiNames: string[] = []
  const multipleAoiVisibilityArrays: number[][] = []
  for (const aoiId in tobiiJson.Aois) {
    const aoi = tobiiJson.Aois[aoiId]
    const aoiName = aoi.Name
    const aoiKeyFrames = aoi.KeyFrames
    const aoiVisibilityArr = processTobiiKeyFrames(aoiKeyFrames)
    multipleAoiNames.push(aoiName)
    multipleAoiVisibilityArrays.push(aoiVisibilityArr)
  }
  return {
    stimulusId,
    multipleAoiNames,
    multipleAoiVisibilityArrays,
    participantId,
  }
}

/**
 * Process the keyframes of an AOI in Tobii JSON data
 * REMEMBER! Dynamic AOIs are in seconds, not milliseconds!
 * @param keyFrames keyframes of the AOI
 * @returns an array of timestamps when the AOI is visible
 * @throws if the number of keyframes is odd (not closed AOI visibility data interval)
 */
export const processTobiiKeyFrames = (
  keyFrames: Record<number, { IsActive: boolean; Seconds: number }>
): number[] => {
  const visibilityArr = []
  let isAoiCurrentlyVisible = false
  for (const keyFrameId in keyFrames) {
    const keyFrame = keyFrames[keyFrameId]
    const isActive = keyFrame.IsActive
    const seconds = keyFrame.Seconds
    if (isActive && !isAoiCurrentlyVisible) {
      visibilityArr.push(seconds * 1000) // ms
      isAoiCurrentlyVisible = true
    }
    if (!isActive && isAoiCurrentlyVisible) {
      visibilityArr.push(seconds * 1000) // ms
      isAoiCurrentlyVisible = false
    }
  }
  if (visibilityArr.length % 2 !== 0) {
    throw new Error('Odd number of keyframes in AOI visibility data')
  }
  return visibilityArr
}
