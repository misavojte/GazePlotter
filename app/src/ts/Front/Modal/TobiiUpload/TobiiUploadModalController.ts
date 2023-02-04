import { AbstractModalController } from '../AbstractModalController'
import { TobiiUploadModalModel } from './TobiiUploadModalModel'

export class TobiiUploadModalController extends AbstractModalController {
  model: TobiiUploadModalModel
  constructor (model: TobiiUploadModalModel) {
    super()
    this.model = model
  }

  handleSubmitEvent (e: Event): void {
    const target = e.target as HTMLFormElement
    const formData = new FormData(target)
    const stimuliParsing = formData.get('stimuli_parsing') as string
    if (stimuliParsing !== 'default' && stimuliParsing !== 'event') throw new Error('Invalid stimuli parsing type')
    this.model.fireUpload(stimuliParsing)
  }
}
