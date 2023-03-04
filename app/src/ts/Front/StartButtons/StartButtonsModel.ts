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
  failMessage: string | null = null

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
        } else if (fileType === 'unknown') {
          this.fail('Unknown file type')
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
    try {
      const settings = this.parsingSettings
      if (settings === null) throw new Error('parsingSettings is null')
      this.worker.postMessage({ type: 'settings', data: settings.workerSettings })
      if (this.isStreamTransferable()) {
        this.processDataAsStream(settings.files)
      } else {
        void this.processDataAsArrayBuffer(settings.files)
      }
    } catch (e) {
      console.error(e)
      this.fail('Error while transferring data to worker')
    }
  }

  processDataAsStream (files: File[]): void {
    for (let index = 0; index < files.length; index++) {
      const stream = files[index].stream()
      this.worker.postMessage({ type: 'stream', data: stream }, [stream])
    }
  }

  async processDataAsArrayBuffer (files: File[]): Promise<void> {
    for (let index = 0; index < files.length; index++) {
      const buffer = await files[index].arrayBuffer()
      this.worker.postMessage({ type: 'buffer', data: buffer }, [buffer])
    }
  }

  isStreamTransferable (): boolean {
    const stream = new ReadableStream({
      start (controller) {
        controller.enqueue(new Uint8Array([]))
        controller.close()
      }
    })
    try {
      this.worker.postMessage({ type: 'test-stream', stream }, [stream])
      return true
    } catch (error) {
      return false
    }
  }

  fail (message: string): void {
    this.failMessage = message
    this.notify('fail', ['workplaceModel'])
  }
}
