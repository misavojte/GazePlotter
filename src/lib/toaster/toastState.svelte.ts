import type { ToastFillingType } from './types'
import { generateUniqueId } from '$lib/shared/utils/idUtils'

export class ToastState {
  current = $state<ToastFillingType[]>([])

  add(toast: ToastFillingType): void {
    this.current = [...this.current, toast]
  }

  remove(id: number): void {
    this.current = this.current.filter(t => t.id !== id)
  }

  addError(message: string): void {
    this.add({
      id: generateUniqueId(),
      title: 'Error',
      message,
      type: 'error',
      duration: 8000,
    })
  }

  addSuccess(message: string): void {
    this.add({
      id: generateUniqueId(),
      title: 'Success',
      message,
      type: 'success',
      duration: 4000,
    })
  }

  addWarning(message: string): void {
    this.add({
      id: generateUniqueId(),
      title: 'Warning',
      message,
      type: 'warning',
      duration: 6000,
    })
  }

  addInfo(message: string): void {
    this.add({
      id: generateUniqueId(),
      title: 'Info',
      message,
      type: 'info',
      duration: 8000,
    })
  }

  clear(): void {
    this.current = []
  }
}
