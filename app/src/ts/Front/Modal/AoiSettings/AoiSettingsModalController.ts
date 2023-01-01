import { AbstractModalController } from '../AbstractModalController'
import { AoiSettingsModalModel } from './AoiSettingsModalModel'

export class AoiSettingsModalController extends AbstractModalController {
  model: AoiSettingsModalModel
  constructor (model: AoiSettingsModalModel) {
    super()
    this.model = model
  }

  handleSubmitEvent (e: Event): void {
    const target = e.target as HTMLFormElement
    const formData = new FormData(target)
    const aoiNames = formData.getAll('displayed_name') as string[]
    const aoiColors = formData.getAll('color') as string[]
    const aoiIds = formData.getAll('aoi_id').map(x => Number(x))
    this.model.fireUpdateAoi(aoiIds, aoiNames, aoiColors)
  }

  handleOtherClickEvent (e: Event): void {
    const target = e.target as HTMLElement
    if (target.classList.contains('bi-arrow-up-short')) return this.moveViewRowUp(target)
    if (target.classList.contains('bi-arrow-down-short')) this.moveViewRowDown(target)
  }

  moveViewRowUp (target: HTMLElement): void {
    const rowToMove = this.#getRowToMove(target)
    if (rowToMove.previousElementSibling != null) {
      rowToMove.after(rowToMove.previousElementSibling)
    } else {
      rowToMove.parentElement?.append(rowToMove)
    }
  }

  moveViewRowDown (target: HTMLElement): void {
    const rowToMove = this.#getRowToMove(target)
    if (rowToMove.nextElementSibling != null) {
      rowToMove.before(rowToMove.nextElementSibling)
    } else {
      rowToMove.parentElement?.prepend(rowToMove)
    }
  }

  #getRowToMove (target: HTMLElement): HTMLElement {
    const rowToMove = target.closest('.gr-line')
    if (!(rowToMove instanceof HTMLElement)) throw new Error('AoiSettingsModalController.#getRowToMove() - rowToMove not HTMLElement')
    return rowToMove
  }
}
