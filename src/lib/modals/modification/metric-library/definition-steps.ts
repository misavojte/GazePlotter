import { defineModal } from '$lib/modals/defineModal'
import PickCategory from './PickCategory.svelte'
import PickMetric from './PickMetric.svelte'
import ConfigureMetric from './ConfigureMetric.svelte'

export const pickCategoryModal = defineModal({
  component: PickCategory,
  title: 'Pick category',
})

export const pickMetricModal = defineModal({
  component: PickMetric,
  title: 'Pick metric',
})

export const configureMetricModal = defineModal({
  component: ConfigureMetric,
  title: 'Configure metric',
})
