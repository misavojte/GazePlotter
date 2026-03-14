import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const downloadTransitionMatrixModal = defineModal({
  component: Modal,
  title: 'Download Transition Matrix',
})
