import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'
import { encodeString } from '$lib/gaze-data/back-process/utils/byteUtils'

export class OgamaEyeDeserializer extends AbstractEyeDeserializer {
  stimulusName: string
  cParticipant: number
  cSegments: number

  private readonly stimulusBytes: Uint8Array
  private readonly hashBytes: Uint8Array

  private readonly pParticipant = 0
  private readonly pSegments = 1

  constructor(
    header: string[],
    fileName: string,
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ) {
    super(columnDelimiter, encoding)
    // extract name from file name (SimilarityXXX.txt) where XXX is the stimulus name
    // this.stimulusName = fileName.split('.')[0].split('Similarity')[1]
    this.stimulusName = fileName.split('.')[0]
    this.stimulusBytes = encodeString(this.stimulusName, this.encoding)
    this.hashBytes = encodeString('#', this.encoding)
    this.cParticipant = this.getIndex(header, 'Sequence Similarity')
    this.cSegments = this.getIndex(header, 'Scanpath string')

    this.setupColumns([this.cParticipant, this.cSegments])
  }

  finalize(): void {
    return
  }

  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    const segmentsBytes = this.getBytes(this.pSegments)
    const participantBytes = this.getBytes(this.pParticipant)
    if (!segmentsBytes.length || !participantBytes.length) return

    const step = this.encoding === 'utf-8' ? 1 : 2
    let index = 0
    for (let i = 0; i + step <= segmentsBytes.length; i += step) {
      const slice = segmentsBytes.subarray(i, i + step)
      const isHash = this.bytesEqual(slice, this.hashBytes)
      const aoi = isHash ? null : [slice]
      this.emitSegment(
        index,
        index + 1,
        0,
        this.stimulusBytes,
        participantBytes,
        aoi
      )
      index++
    }
  }

  private bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
}
