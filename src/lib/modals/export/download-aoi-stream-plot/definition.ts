import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const downloadAoiStreamPlotModal = defineModal({
  component: Modal,
  title: 'Download Time-binned AOI Occupancy',
})
