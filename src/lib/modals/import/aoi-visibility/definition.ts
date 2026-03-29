import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const aoiVisibilityModal = defineModal({
  component: Modal,
  title: 'AOI visibility',
})
