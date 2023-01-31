import { AbstractModel } from '../Common/AbstractModel'
import { ETDInterface } from '../../Data/EyeTrackingData'

export class StartButtonsModel extends AbstractModel {
  readonly observerType = 'startModel'
  eyeTrackingData: ETDInterface | null = null
  worker: Worker = new Worker(new URL('../../Back/Worker/DataUploadWorker.ts', import.meta.url), { type: 'module' })

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
    const filenames: string[] = []
    for (let index = 0; index < file.length; index++) {
      filenames.push(file[index].name)
    }
    this.worker.postMessage(filenames)
    this.processDataAsStream(file)
    this.worker.onmessage = (event) => {
      this.eyeTrackingData = event.data as ETDInterface
      this.notify('eyeTrackingData', ['workplaceModel'])
    }
  }

  processDataAsStream (files: FileList): void {
    for (let index = 0; index < files.length; index++) {
      const stream = files[index].stream()
      try {
        // try to pass ReadableStream as transferable (RS not transferable in TS 4.7.4 thanks to its low support)
        // @ts-expect-error
        this.worker.postMessage(stream, [stream])
      } catch (error) {
        void files[index].arrayBuffer().then((arrayBuffer) => {
          this.worker.postMessage(arrayBuffer, [arrayBuffer])
        })
      }
    }
  }
}
