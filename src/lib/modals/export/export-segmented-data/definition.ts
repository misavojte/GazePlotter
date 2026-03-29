import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const exportSegmentedDataModal = defineModal({
  component: Modal,
  title: 'Export Segmented Data',
})
