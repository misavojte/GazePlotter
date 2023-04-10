import { EyeTrackingParserAbstractPostprocessor } from './EyeTrackingParserAbstractPostprocessor'
import { ETDInterface } from '../../../Data/EyeTrackingData'

export class EyeTrackingParserOgamaPostprocessor extends EyeTrackingParserAbstractPostprocessor {
  process (data: ETDInterface): ETDInterface {
    this.orderAoisAlphabetically(data)
    data.isOrdinalOnly = true
    return data
  }
}
