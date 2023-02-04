import { AbstractModel } from '../Common/AbstractModel'
import { ETDInterface } from '../../Data/EyeTrackingData'
import { StartButtonsService } from './StartButtonsService'
import { StartButtonsPreParseSettingsType } from '../../Types/Parsing/StartButtonsPreParseSettingsType'

export class StartButtonsModel extends AbstractModel {
  readonly observerType = 'startModel'
  eyeTrackingData: ETDInterface | null = null
  worker: Worker = new Worker(new URL('../../Back/Worker/DataUploadWorker.ts', import.meta.url), { type: 'module' })
  service: StartButtonsService = new StartButtonsService()
  parsingSettings: StartButtonsPreParseSettingsType | null = null

  fireUploadWithUserInput (parsingType: string): void {
    const settings = this.parsingSettings
    if (settings === null) throw new Error('parsingSettings is null')
    settings.workerSettings.userInputSetting = parsingType
    this.startWorkerProcessing()
  }

  startDemo (): void {
    this.notify('start', ['workplaceModel'])
    fetch('/demodata.json')
      .then(async response => {
        return await response.json()
      })
      .then(x => {
        this.eyeTrackingData = x as ETDInterface // TODO: validate
        this.notify('eyeTrackingData', ['workplaceModel'])
      }).catch(e => {
        console.log(e)
      }
      )
  }

  startNewFile (file: Object): void {
    if (!(file instanceof FileList)) return
    this.notify('start', ['workplaceModel'])
    const parsingSettingsPromise = this.service.preprocessEyeTrackingFiles(file)
    void parsingSettingsPromise.then(
      (parsingSettings) => {
        this.parsingSettings = parsingSettings
        const fileType = parsingSettings.workerSettings.type
        if (fileType === 'tobii-with-event') {
          this.notify('open-tobii-upload-modal', ['workplaceModel'])
        } else {
          this.startWorkerProcessing()
        }
      }
    )
    this.worker.onmessage = (event) => {
      this.eyeTrackingData = event.data as ETDInterface
      this.notify('eyeTrackingData', ['workplaceModel'])
    }
  }

  startWorkerProcessing (): void {
    const settings = this.parsingSettings
    if (settings === null) throw new Error('parsingSettings is null')
    this.worker.postMessage(settings.workerSettings)
    this.processDataAsStream(settings.files)
  }

  processDataAsStream (files: File[]): void {
    for (let index = 0; index < files.length; index++) {
      const stream = files[index].stream()
      try {
        this.worker.postMessage(stream, [stream])
      } catch (error) {
        void files[index].arrayBuffer().then((arrayBuffer) => {
          this.worker.postMessage(arrayBuffer, [arrayBuffer])
        })
      }
    }
  }
}
