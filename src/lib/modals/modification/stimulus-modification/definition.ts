import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const stimulusModificationModal = defineModal({
  component: Modal,
  title: 'Stimulus customization',
})
