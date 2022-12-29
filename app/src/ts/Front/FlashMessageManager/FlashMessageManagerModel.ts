import { FlashMessageItemModel } from '../FlashMessageItem/FlashMessageItemModel'
import { FlashMessageItemController } from '../FlashMessageItem/FlashMessageItemController'
import { FlashMessageItemView } from '../FlashMessageItem/FlashMessageItemView'
import { AbstractModel } from '../Common/AbstractModel'
import { FlashMessageManagerView } from './FlashMessageManagerView'
import { FlashMessageManagerController } from './FlashMessageManagerController'

export class FlashMessageManagerModel extends AbstractModel {
  elementId: string
  promise: Promise<void> = Promise.resolve()
  constructor (elementId: string = 'flash-message-manager') {
    super()
    this.elementId = elementId
    this.initViewController()
  }

  initViewController (): void {
    void new FlashMessageManagerView(new FlashMessageManagerController(this))
  }

  addFlashMessage (message: string, type: 'error' | 'warn' | 'info' | 'success'): void {
    this.addFlashFromModel(new FlashMessageItemModel(message, type))
  }

  addFlashFromModel (model: FlashMessageItemModel): void {
    this.promise.then(() => {
      const controller = new FlashMessageItemController(model)
      const view = new FlashMessageItemView(controller)
      this.promise = view.render(this.elementId)
    })
      .catch((e) => {
        console.error(e)
      })
  }
}
