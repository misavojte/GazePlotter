import { AbstractModel } from '../Common/AbstractModel'
import { ETDInterface } from '../../Data/EyeTrackingData'
import { StartButtonsService } from './StartButtonsService'
import { StartButtonsPreParseSettingsType } from '../../Types/Parsing/StartButtonsPreParseSettingsType'

export class StartButtonsModel extends AbstractModel {
  readonly observerType = 'startModel'
  isProcessing: boolean = false
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
    this.isProcessing = true
    this.notify('start', [])
    void import('../../Data/DemoData').then(x => {
      this.eyeTrackingData = x.demoData
      this.isProcessing = false
      this.notify('eyeTrackingData', [])
    }).catch(e => {
      console.log(e)
    })
  }

  startNewFile (file: Object): void {
    this.isProcessing = true
    if (!(file instanceof FileList)) return
    this.notify('start', [])
    if (file[0].name.endsWith('.json')) return this.loadJsonFile(file[0])
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
      this.isProcessing = false
      this.eyeTrackingData = event.data as ETDInterface
      this.notify('eyeTrackingData', [])
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
    this.notify('fail', [])
  }

  loadJsonFile (file: File): void {
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target === null) return
      this.eyeTrackingData = JSON.parse(event.target.result as string).main as ETDInterface
      this.notify('eyeTrackingData', [])
    }
    reader.readAsText(file)
  }
}
