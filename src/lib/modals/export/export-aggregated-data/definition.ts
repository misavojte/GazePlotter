import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const exportAggregatedDataModal = defineModal({
  component: Modal,
  title: 'Export Aggregated Data',
})
