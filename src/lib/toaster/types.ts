/**
 * Optional call-to-action link rendered beneath a toast message. Toast links
 * always open in a new tab so they never navigate away from (and discard) the
 * current workspace.
 */
export interface ToastLink {
  href: string
  label: string
}

/**
 * Filling for Toaster messages
 * @id {number} - id of message for deletion
 * @title {string} - title of message
 * @message {string} - message to show
 * @type {'success' | 'error' | 'warning' | 'info'} - type of message
 * @duration {number | null} - duration of message in ms, null for infinite
 * @link {ToastLink} - optional call-to-action link shown under the message
 */
export interface ToastFillingType {
  id: number
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number | null
  link?: ToastLink
}
