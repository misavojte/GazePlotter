import type { ToastFillingType } from './types'
import { generateUniqueId } from '$lib/shared/utils/idUtils'

let _toasts = $state<ToastFillingType[]>([])

/**
 * Global accessor for the toast state.
 */
export const toastState = {
  get current() { return _toasts },
  set current(value: ToastFillingType[]) { _toasts = value }
}

export const addToast = (toast: ToastFillingType): void => {
  _toasts.push(toast)
}

export const removeToast = (id: number): void => {
  _toasts = _toasts.filter(t => t.id !== id)
}

export const addErrorToast = (message: string): void => {
  addToast({
    id: generateUniqueId(),
    title: 'Error',
    message,
    type: 'error',
    duration: 8000,
  })
}

export const addSuccessToast = (message: string): void => {
  addToast({
    id: generateUniqueId(),
    title: 'Success',
    message,
    type: 'success',
    duration: 4000,
  })
}

export const addInfoToast = (message: string): void => {
  addToast({
    id: generateUniqueId(),
    title: 'Info',
    message,
    type: 'info',
    duration: 8000,
  })
}