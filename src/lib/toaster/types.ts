/**
 * Optional call-to-action link rendered beneath a toast message. Toast links
 * always open in a new tab so they never navigate away from (and discard) the
 * current workspace.
 */
interface ToastLink {
  href: string
  label: string
}

export interface ToastFillingType {
  /** Identity for removal. */
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  /** Auto-dismiss delay in ms; null keeps the toast until closed manually. */
  duration: number | null
  /** Optional call-to-action link shown under the message. */
  link?: ToastLink
}
