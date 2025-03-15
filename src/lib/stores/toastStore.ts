import { writable } from 'svelte/store'
import type { ToastFillingType } from '$lib/type/Filling/ToastFilling/ToastFillingType'

export const toastStore = writable<ToastFillingType[]>([])

export const addToast = (toast: ToastFillingType): void => {
  toastStore.update(toasts => [...toasts, toast])
}

export const addErrorToast = (message: string): void => {
  addToast({
    id: getUniqueToastId(),
    title: 'Error',
    message,
    type: 'error',
    duration: 8000,
  })
}

export const addSuccessToast = (message: string): void => {
  addToast({
    id: getUniqueToastId(),
    title: 'Success',
    message,
    type: 'success',
    duration: 3000,
  })
}

export const addInfoToast = (message: string): void => {
  addToast({
    id: getUniqueToastId(),
    title: 'Info',
    message,
    type: 'info',
    duration: 8000,
  })
}

const getUniqueToastId = (): number => {
  /* Not date dependent, because it is possible to add multiple toasts in one millisecond */
  return Math.floor(Math.random() * 1000000000)
}
