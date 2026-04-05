/**
 * Service functions for processing AOI visibility data
 * @category Services
 * @module services/aoiVisibilityServices
 */
import { getStimulusHighestEndTime } from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'

type AoiVisibilityResult = {
  multipleAoiNames: string[]
  multipleAoiVisibilityArrays: number[][]
}

/**
 * Parse event file text into AOI names + alternating visibility arrays.
 * Engine-free — suitable for use during ingest before engine is loaded.
 * @param text raw file content (SMI XML or Tobii JSON)
 * @param highestEndTime end time in ms for open-ended SMI keyframes
 */
export const processAoiVisibilityFromText = (
  text: string,
  highestEndTime: number
): AoiVisibilityResult => {
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')

  if (xml.getElementsByTagName('DynamicAOI').length > 0) {
    return processSmiFromXml(xml, highestEndTime)
  }

  const tobiiJson = JSON.parse(text)
  if (isTobiiJson(tobiiJson)) {
    return processTobiiChannels(tobiiJson)
  }

  throw new Error('Unrecognized event file format')
}

/**
 * Main function to process the AOI visibility data (engine-dependent wrapper).
 * @param stimulusId id of the stimulus to which the AOIs belong
 * @param participantId id of the participant to which the AOIs belong (null if not participant-specific and should be applied to all participants)
 * @param files list of files to process
 */
export const processAoiVisibility = async (
  engine: DataEngine,
  stimulusId: number,
  participantId: number | null,
  files: FileList
): Promise<{
  stimulusId: number
  multipleAoiNames: string[]
  multipleAoiVisibilityArrays: number[][]
  participantId: number | null
}> => {
  const text = await files[0].text()
  const highestEndTime = getStimulusHighestEndTime(engine, stimulusId)
  const result = processAoiVisibilityFromText(text, highestEndTime)
  return { stimulusId, ...result, participantId }
}

/**
 * Parse SMI XML document into AOI names + visibility arrays (engine-free).
 */
const processSmiFromXml = (
  xml: Document,
  highestEndTime: number
): AoiVisibilityResult => {
  const aoiNodes = xml.getElementsByTagName('DynamicAOI')
  const multipleAoiNames: string[] = []
  const multipleAoiVisibilityArrays: number[][] = []
  for (let i = 0; i < aoiNodes.length; i++) {
    const aoiName = aoiNodes[i].querySelector('Name')?.innerHTML
    if (aoiName === undefined) continue
    const aoiKeyFrames = aoiNodes[i].getElementsByTagName('KeyFrame')
    const aoiVisibilityArr = processSmiKeyFrames(aoiKeyFrames, highestEndTime)
    multipleAoiNames.push(aoiName)
    multipleAoiVisibilityArrays.push(aoiVisibilityArr)
  }
  return { multipleAoiNames, multipleAoiVisibilityArrays }
}

/**
 * Process the keyframes of a dynamic AOI in SMI XML data
 * @param keyFrames keyframes of the dynamic AOI
 * @param highestEndTime end time in ms to close open-ended visibility intervals
 * @returns an array of alternating [start, end, ...] timestamps in ms
 */
export const processSmiKeyFrames = (
  keyFrames: HTMLCollectionOf<Element>,
  highestEndTime: number
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
      visibilityArr.push(highestEndTime)
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
 * Parse Tobii JSON into AOI names + visibility arrays (engine-free).
 */
const processTobiiChannels = (tobiiJson: TobiiJson): AoiVisibilityResult => {
  const multipleAoiNames: string[] = []
  const multipleAoiVisibilityArrays: number[][] = []
  for (const aoiId in tobiiJson.Aois) {
    const aoi = tobiiJson.Aois[aoiId]
    multipleAoiNames.push(aoi.Name)
    multipleAoiVisibilityArrays.push(processTobiiKeyFrames(aoi.KeyFrames))
  }
  return { multipleAoiNames, multipleAoiVisibilityArrays }
}

/**
 * Process Tobii AOI visibility data into a workspace-ready payload.
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
  const result = processTobiiChannels(tobiiJson)
  return { stimulusId, ...result, participantId }
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

/**
 * Convert parsed AOI visibility data into event channel definitions and
 * per-participant stride-2 event buffers ready for EventDataType.
 */
export function buildEventChannelsFromParsed(
  parsed: AoiVisibilityResult,
  participantId: number | null,
  participantCount: number,
  aoiData?: string[][]
): { channelDefs: string[][]; eventBuffers: number[][][] } {
  const channelDefs: string[][] = []
  const eventBuffers: number[][][] = []

  for (let i = 0; i < parsed.multipleAoiNames.length; i++) {
    const name = parsed.multipleAoiNames[i]
    let color = '#888888'
    if (aoiData) {
      for (const row of aoiData) {
        if (row[0] === name || row[1] === name) {
          color = row[2] ?? color
          break
        }
      }
    }
    channelDefs.push([name, name, color])

    // Convert alternating [start, end] to stride-2 [start, duration]
    const intervals = parsed.multipleAoiVisibilityArrays[i]
    const events: number[] = []
    for (let j = 0; j < intervals.length; j += 2) {
      const start = intervals[j]
      const end = intervals[j + 1]
      events.push(start, end != null ? end - start : 0)
    }

    // Per-participant buffer
    const perParticipant: number[][] = Array.from(
      { length: participantCount },
      () => []
    )
    if (participantId !== null) {
      perParticipant[participantId] = events
    } else {
      for (let p = 0; p < participantCount; p++) perParticipant[p] = events
    }
    eventBuffers.push(perParticipant)
  }

  return { channelDefs, eventBuffers }
}
