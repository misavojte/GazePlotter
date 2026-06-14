import type { ToastFillingType } from './types'
import { generateUniqueId } from '$lib/shared/utils/idUtils'

const MAX_VISIBLE_TOASTS = 5
const MAX_MESSAGE_LENGTH = 280
const TOAST_DEDUP_WINDOW_MS = 2000

function normalizeToastMessage(message: string): string {
  const singleLine = message.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= MAX_MESSAGE_LENGTH) {
    return singleLine
  }

  return `${singleLine.slice(0, MAX_MESSAGE_LENGTH - 3)}...`
}

function pruneExpiredToastTimes(
  recentToastTimes: Map<string, number>,
  now: number
): void {
  for (const [key, lastShownAt] of recentToastTimes) {
    if (now - lastShownAt >= TOAST_DEDUP_WINDOW_MS) {
      recentToastTimes.delete(key)
    }
  }
}

export class ToastState {
  current = $state<ToastFillingType[]>([])
  private readonly recentToastTimes = new Map<string, number>()

  add(toast: ToastFillingType): void {
    const normalizedToast = {
      ...toast,
      message: normalizeToastMessage(toast.message),
    }

    if (normalizedToast.message.length === 0) return

    const now = Date.now()
    pruneExpiredToastTimes(this.recentToastTimes, now)
    const dedupeKey = [
      normalizedToast.type,
      normalizedToast.title,
      normalizedToast.message,
    ].join(':')
    const lastShownAt = this.recentToastTimes.get(dedupeKey)

    if (
      typeof lastShownAt === 'number' &&
      now - lastShownAt < TOAST_DEDUP_WINDOW_MS
    ) {
      return
    }

    this.recentToastTimes.set(dedupeKey, now)
    this.current = [
      ...this.current.slice(-(MAX_VISIBLE_TOASTS - 1)),
      normalizedToast,
    ]
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
      duration: 12000,
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
    this.recentToastTimes.clear()
  }
}
