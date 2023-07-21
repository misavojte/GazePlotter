import { EyeTrackingParserAbstractPostprocessor } from './EyeTrackingParserAbstractPostprocessor'
import { ETDInterface } from '../../../Data/EyeTrackingData'

// Currently used for BeGaze, Tobii and Varjo
export class EyeTrackingParserBasePostprocessor extends EyeTrackingParserAbstractPostprocessor {
  process (data: ETDInterface): ETDInterface {
    this.orderAoisAlphabetically(data)
    this.orderParticipantsAlphabetically(data)
    return data
  }
}
