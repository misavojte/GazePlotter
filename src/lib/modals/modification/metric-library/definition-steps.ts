import { defineModal } from '$lib/modals/defineModal'
import PickMetric from './PickMetric.svelte'
import ConfigureMetric from './ConfigureMetric.svelte'

export const pickMetricModal = defineModal({
  component: PickMetric,
  title: 'Add metric',
})

export const configureMetricModal = defineModal({
  component: ConfigureMetric,
  title: 'Configure metric',
})
