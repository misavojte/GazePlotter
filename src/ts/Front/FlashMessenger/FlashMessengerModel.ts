import { AbstractModel } from '../Common/AbstractModel'
import { FlashMessengerView } from './FlashMessengerView'
import { FlashMessengerController } from './FlashMessengerController'

type FlashMessageType = 'error' | 'warn' | 'info' | 'success'
interface FlashMessage { id: number, message: string, type: FlashMessageType }

export class FlashMessengerModel extends AbstractModel {
  elementId: string
  lastMessageId: number = 0
  messageToAdd: FlashMessage | null = null
  messageIdsToRemove: number[] = []
  activeMessages: Array<{ id: number, timeout: NodeJS.Timeout }> = []

  constructor (elementId: string = 'flash-message-manager') {
    super()
    this.elementId = elementId
    this.initViewController()
  }

  initViewController (): void {
    void new FlashMessengerView(new FlashMessengerController(this))
  }

  addFlashMessage (message: string, type: FlashMessageType): void {
    const id = this.lastMessageId
    this.lastMessageId++
    this.messageToAdd = {
      id,
      message,
      type
    }
    this.notify('add-flash')
    this.messageToAdd = null
    this.activeMessages.push({
      id,
      timeout: this.getTimeout(id, type)
    })
  }

  removeFlashMessage (id: number): void {
    const messageToRemove = this.activeMessages.find((t) => t.id === id)
    if (messageToRemove != null) {
      clearTimeout(messageToRemove.timeout)
      this.activeMessages = this.activeMessages.filter((t) => t.id !== id)
    }
    this.messageIdsToRemove.push(id)
    this.notify('remove-flash')
    this.messageIdsToRemove = []
  }

  /** Returns a timeout that removes the flash message after the given time.
   *  @param id The id of the flash message to remove.
   *  @param type The type of the flash message - if it is an error, the timeout is longer.
   */
  getTimeout (id: number, type: FlashMessageType): NodeJS.Timeout {
    const timeout = type === 'error' ? 10000 : (type === 'warn' ? 10000 : 2500)
    return setTimeout(() => {
      this.removeFlashMessage(id)
    }, timeout)
  }
}
