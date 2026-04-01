import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const downloadScanpathSimilarityPlotModal = defineModal({
  component: Modal,
  title: 'Download Scanpath Similarity Plot',
})
