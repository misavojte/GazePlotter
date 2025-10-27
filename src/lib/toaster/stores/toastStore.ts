import { writable } from 'svelte/store'
import type { ToastFillingType } from '$lib/toaster/types/ToastFillingType'
import { generateUniqueId } from '$lib/shared/utils/idUtils'

export const toastStore = writable<ToastFillingType[]>([])

export const addToast = (toast: ToastFillingType): void => {
  toastStore.update(toasts => [...toasts, toast])
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