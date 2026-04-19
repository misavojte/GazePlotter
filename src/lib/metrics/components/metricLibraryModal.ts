import { defineModal } from '$lib/modals/defineModal'
import MetricLibraryModal from './MetricLibraryModal.svelte'

export const metricLibraryModal = defineModal({
  component: MetricLibraryModal,
  title: 'Metric library',
})
