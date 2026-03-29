import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const participantsGroupsModal = defineModal({
  component: Modal,
  title: 'Participants groups',
})
