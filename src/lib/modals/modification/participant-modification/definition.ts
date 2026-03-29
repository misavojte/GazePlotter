import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const participantModificationModal = defineModal({
  component: Modal,
  title: 'Participant customization',
})
