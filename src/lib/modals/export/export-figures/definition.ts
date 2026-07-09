import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const exportFiguresModal = defineModal({
  component: Modal,
  title: 'Export Figures',
})
