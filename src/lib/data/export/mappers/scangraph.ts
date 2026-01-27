import { type DataType } from '$lib/data/types'
import { type BinaryBufferReader } from '$lib/data/types'
import { getAoiRaw, engine, getSegmentAoiIds } from '$lib/data/engine'

/**
 * Generates a ScanGraph TXT string based on the Similarity Measurements format.
 * Uses ASCII characters (A, B, C...) to represent AOIs.
 */
export async function generateScanGraph(
  metadata: Omit<DataType, 'segments'>,
  reader: BinaryBufferReader,
  stimulusId: number
): Promise<string> {
  let result = ''
  const aoiKey: string[] = []
  const alreadyUsedAoiIds: number[] = []

  const numParticipants = metadata.participants.data.length
  const aoiGroupReader = engine.getAoiGroupReader()

  for (let i = 0; i < numParticipants; i++) {
    const participantName = metadata.participants.data[i][0]
    result += participantName + '\t'

    reader.forEachSegment(stimulusId, i, (segmentIndex: number) => {
      const aoiIds = getSegmentAoiIds(
        stimulusId,
        i,
        segmentIndex - reader.getSegmentRange(stimulusId, i).startIndex
      )

      if (aoiIds.length === 0) {
        result += '#'
      } else {
        const rawId = aoiIds[0]
        const interpretedAoi = getAoiRaw(stimulusId, rawId, metadata)
        const letter = String.fromCharCode(65 + interpretedAoi.id)
        result += letter

        if (!alreadyUsedAoiIds.includes(interpretedAoi.id)) {
          aoiKey.push(`${letter} = ${interpretedAoi.displayedName}`)
          alreadyUsedAoiIds.push(interpretedAoi.id)
        }
      }
    })
    result += '\r\n'
  }

  aoiKey.sort()

  const header = `#
#
#
# Key:
# # = no fixation, ${aoiKey.join(', ')}
#
# The following part is the sequence similarity of the scanpaths
#
Sequence Similarity\tScanpath string
`
  return header + result
}
