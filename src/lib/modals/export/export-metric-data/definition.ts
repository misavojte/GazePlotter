import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const exportMetricDataModal = defineModal({
  component: Modal,
  title: 'Export Metric Data',
})
