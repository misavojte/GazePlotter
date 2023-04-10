import { EyeTrackingParserAbstractPostprocessor } from './EyeTrackingParserAbstractPostprocessor'
import { ETDInterface } from '../../../Data/EyeTrackingData'

export class EyeTrackingParserTobiiPostprocessor extends EyeTrackingParserAbstractPostprocessor {
  process (data: ETDInterface): ETDInterface {
    this.orderAoisAlphabetically(data)
    return data
  }
}
