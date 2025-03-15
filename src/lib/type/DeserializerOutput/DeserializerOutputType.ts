import type { SingleDeserializerOutput } from './SingleDeserializerOutput/SingleDeserializerOutput'

export type DeserializerOutputType =
  | SingleDeserializerOutput
  | null
  | SingleDeserializerOutput[]
