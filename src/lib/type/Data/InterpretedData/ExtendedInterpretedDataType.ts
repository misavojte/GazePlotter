import type { BaseInterpretedDataType } from './BaseInterpretedDataType.ts'

/**
 * Used for AOI and category basic information.
 */
export interface ExtendedInterpretedDataType extends BaseInterpretedDataType {
  color: string
}
