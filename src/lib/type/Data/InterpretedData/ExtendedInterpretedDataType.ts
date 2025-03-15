import type { BaseInterpretedDataType } from './BaseInterpretedDataType'

/**
 * Used for AOI and category basic information.
 */
export interface ExtendedInterpretedDataType extends BaseInterpretedDataType {
  color: string
}
