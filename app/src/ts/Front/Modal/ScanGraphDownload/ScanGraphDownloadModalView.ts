import { AbstractModalView } from '../AbstractModalView'
import { ScanGraphDownloadModalController } from './ScanGraphDownloadModalController'

export class ScanGraphDownloadModalView extends AbstractModalView {
  controller: ScanGraphDownloadModalController
  bodyHtml: string
  constructor (controller: ScanGraphDownloadModalController) {
    super(controller)
    this.controller = controller
    this.bodyHtml = this.printBodyHtml()
  }

  printBodyHtml (): string {
    return `
    <form class="js-submit">
    <fieldset>
    <legend>For further visualizations in <a href="http://eyetracking.upol.cz/scangraph/">ScanGraph</a> tool</legend>
        <label class="flex-row">
            File name
            <input type="text" name="file_name" value="ScanGraph">
        </label>
        <label class="flex-row">
          Stimulus
          <select name="stimulus">
            ${this.printOptions()}
          </select>
        </label>
    </fieldset>
    <input type="submit" value="Start Download">   
    </form>
    `
  }

  printOptions (): string {
    const data = this.controller.model.data
    const noOfStimuli = data.noOfStimuli
    let options = ''
    for (let i = 0; i < noOfStimuli; i++) {
      options += `<option value="${i}" ${i === 0 ? 'selected' : ''}>${data.getStimulDisplayedName(i)}</option>`
    }
    return options
  }
}
