import { ETDInterface } from '../../../Data/EyeTrackingData'

export abstract class EyeTrackingParserAbstractPostprocessor {
  abstract process (data: ETDInterface): ETDInterface
}
