import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const exportScangraphModal = defineModal({
  component: Modal,
  title: 'Export ScanGraph',
})
