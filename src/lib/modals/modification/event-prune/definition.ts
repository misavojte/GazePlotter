import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const eventPruneModal = defineModal({
  component: Modal,
  title: 'Imported events',
})
