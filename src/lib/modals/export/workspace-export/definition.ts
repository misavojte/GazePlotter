import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const downloadWorkspaceModal = defineModal({
  component: Modal,
  title: 'Export Options',
})
