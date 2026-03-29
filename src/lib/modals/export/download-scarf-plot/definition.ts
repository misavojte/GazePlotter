import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const downloadScarfPlotModal = defineModal({
  component: Modal,
  title: 'Download Scarf Plot',
})
