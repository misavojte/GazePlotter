import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const exportEventDataModal = defineModal({
  component: Modal,
  title: 'Export Event Data',
})
