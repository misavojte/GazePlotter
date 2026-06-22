import { defineModal } from '$lib/modals/defineModal'
import Modal from './Modal.svelte'

export const metricLibraryModal = defineModal({
  component: Modal,
  title: 'Metric library',
})
