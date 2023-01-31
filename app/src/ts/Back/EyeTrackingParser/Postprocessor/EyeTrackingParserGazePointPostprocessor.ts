import { EyeTrackingParserAbstractPostprocessor } from './EyeTrackingParserAbstractPostprocessor'
import { ETDInterface } from '../../../Data/EyeTrackingData'

export class EyeTrackingParserGazePointPostprocessor extends EyeTrackingParserAbstractPostprocessor {
  process (data: ETDInterface): ETDInterface {
    return data
  }
}
