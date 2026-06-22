import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const exportScanpathSimilarityModal = defineModal({
  component: Modal,
  title: 'Export Scanpath Similarity',
})
