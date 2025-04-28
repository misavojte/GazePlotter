import type { DeserializerOutputType } from '$lib/gaze-data/back-process/types/DeserializerOutputType.js'

export abstract class AbstractEyeDeserializer {
  abstract deserialize(row: string[]): DeserializerOutputType
  abstract finalize(): DeserializerOutputType
  getIndex(header: string[], name: string): number {
    const index = header.indexOf(name)
    if (index === -1)
      throw new Error(
        `Invalid data file for ${this.constructor.name} deserializer.  Column ${name} not found in header`
      )
    return index
  }
}
