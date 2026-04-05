import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const eventChannelModificationModal = defineModal({
  component: Modal,
  title: 'Event customization',
})
