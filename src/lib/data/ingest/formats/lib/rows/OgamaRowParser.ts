import { RowParser } from './RowParser'
import { encodeString } from '$lib/data/ingest/utils/byteUtils'

export class OgamaRowParser extends RowParser {
  stimulusName: string

  private readonly stimulusBytes: Uint8Array
  private readonly decoder: TextDecoder

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
    this.decoder = new TextDecoder(this.encoding)

    this.setupColumns(
      this.requireColumns(header, ['Sequence Similarity', 'Scanpath string'])
    )
  }

  protected override deserializeFromBytes(): void {
    const segmentsBytes = this.getBytes(this.pSegments)
    const participantBytes = this.getBytes(this.pParticipant)
    if (!segmentsBytes.length || !participantBytes.length) return

    // One AOI per code point: stepping by byte or UTF-16 unit splits a
    // non-ASCII letter such as Ω or 漢 into broken, duplicate AOI names.
    let index = 0
    for (const letter of this.decoder.decode(segmentsBytes)) {
      const aoi = letter === '#' ? null : [encodeString(letter, this.encoding)]
      this.onSegment?.(
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
}
