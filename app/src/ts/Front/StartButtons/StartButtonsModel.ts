import { AbstractModel } from '../Common/AbstractModel'

export class StartButtonsModel extends AbstractModel {
  readonly observerType = 'startModel'

  jsonFile: Object | null = null

  startDemo (): void {
    this.notify('start', ['workplaceModel'])
    fetch('/demodata.json')
      .then(async response => {
        return await response.json()
      })
      .then(x => {
        this.jsonFile = x
        this.notify('eyeTrackingData', ['workplaceModel'])
      }).catch(e => {
        console.log(e)
      }
      )
  }

  startNewFile (file: Object): void {
    if (!(file instanceof FileList)) return
    this.notify('start', ['workplaceModel'])
    // const fileType = file[0].name.split('.').pop();
    // console.log("A");
    // throw new TypeError('Unrecognized eye-tracking data file, check supported types')
  }
}
