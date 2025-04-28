import type { SingleDeserializerOutput } from './SingleDeserializerOutput'

export type DeserializerOutputType =
  | SingleDeserializerOutput
  | null
  | SingleDeserializerOutput[]
