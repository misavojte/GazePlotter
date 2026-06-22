import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const categoryModificationModal = defineModal({
  component: Modal,
  title: 'Category customization',
})
