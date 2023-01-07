import { EyeTrackingParserAbstractReducer } from './EyeTrackingParserAbstractReducer'

export class EyeTrackingParserTobiiReducer extends EyeTrackingParserAbstractReducer {
  reduce (row: string[]): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: Array<string | null> } | null {
    console.log('EyeTrackingParserTobiiReducer.reduce()', row)
    return { aoi: [], category: '', end: '', participant: '', start: '', stimulus: '' }
  }
}
