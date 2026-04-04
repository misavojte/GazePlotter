import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const downloadRecurrencePlotModal = defineModal({
  component: Modal,
  title: 'Download Recurrence Plot',
})
