import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const downloadPlotModal = defineModal({
  component: Modal,
  title: 'Download Plot',
})
