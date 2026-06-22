import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const exportWorkspaceModal = defineModal({
  component: Modal,
  title: 'Export Options',
})
