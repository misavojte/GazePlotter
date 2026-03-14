import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const metadataInfoModal = defineModal({
  component: Modal,
  title: 'Metadata Report',
})
