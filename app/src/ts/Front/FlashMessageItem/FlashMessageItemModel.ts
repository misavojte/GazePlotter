import { AbstractModel } from '../Common/AbstractModel'

export class FlashMessageItemModel extends AbstractModel {
  message: string
  type: 'error' | 'warn' | 'info' | 'success'
  constructor (message: string, type: 'error' | 'warn' | 'info' | 'success') {
    super()
    this.message = message
    this.type = type
    setTimeout(() => {
      this.notify('close-flash')
    }, (type === 'error' ? 10000 : 3500))
  }

  fireClose (): void {
    this.notify('close-flash')
  }
}
