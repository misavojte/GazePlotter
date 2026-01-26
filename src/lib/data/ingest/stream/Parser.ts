/**
 * Responsible for parsing the stream of const from the eye tracking file to chunks of text.
 *
 * The stream is decoded using a TextDecoderStream.
 * File is assumed to be always complete, there is no need to check for end of file.
 */
export class EyeParser {
  readonly rs: ReadableStream
  readonly reader: ReadableStreamDefaultReader<string>

  isDone = false

  constructor (rs: ReadableStream, decoder: TextDecoderStream = new TextDecoderStream()) {
    this.rs = rs.pipeThrough(decoder)
    this.reader = this.rs.getReader()
  }

  /**
   * Parses one chunk of text from the stream.
   * @returns {Promise<string>} The chunk of text.
   * @throws {Error} If the parser is done.
   */
  async getTextChunk (): Promise<string> {
    if (this.isDone) throw new Error('EyeParser is done')
    const { value, done } = await this.reader.read()
    if (done) {
      this.isDone = true
      return ''
    }
    return value
  }
}
