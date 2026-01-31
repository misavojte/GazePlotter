/**
 * Filling for Toaster messages
 * @id {number} - id of message for deletion
 * @title {string} - title of message
 * @message {string} - message to show
 * @type {'success' | 'error' | 'warning' | 'info'} - type of message
 * @duration {number | null} - duration of message in ms, null for infinite
 */
export interface ToastFillingType {
  id: number
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number | null
}
