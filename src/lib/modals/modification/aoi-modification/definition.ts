import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const aoiModificationModal = defineModal({
  component: Modal,
  title: 'AOIs & selections',
})
