import { type EngineMetadata } from '$lib/data/types'
import { type BinaryBufferReader } from '$lib/data/types'
import { AoiGroupReader } from '$lib/data/binary'
import { getAoiRaw } from '$lib/data/engine/utils/interpreters'

/**
 * Generates a ScanGraph TXT string based on the Similarity Measurements format.
 * Uses ASCII characters (A, B, C...) to represent AOIs.
 */
export async function generateScanGraph(
  metadata: EngineMetadata,
  reader: BinaryBufferReader,
  aoiGroupReader: AoiGroupReader,
  stimulusId: number
): Promise<string> {
  let result = ''
  const aoiKey: string[] = []
  const alreadyUsedAoiIds: number[] = []
  const aoiBuffer = new Uint16Array(32)

  const numParticipants = metadata.participants.data.length
  for (let i = 0; i < numParticipants; i++) {
    const participantName = metadata.participants.data[i][1] ?? metadata.participants.data[i][0]
    result += participantName + '\t'

    reader.forEachSegment(stimulusId, i, (segmentIndex: number) => {
      const aoiCount = aoiGroupReader.getSegmentAoisUniqueDirect(
        segmentIndex,
        stimulusId,
        aoiBuffer
      )

      if (aoiCount === 0) {
        result += '#'
      } else {
        const interpretedAoi = getAoiRaw(stimulusId, aoiBuffer[0], metadata)
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
