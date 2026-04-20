import './init'
import { getMetricDefs } from './defineMetric'
import { getCategoryOrder, getCategoryLabels } from './categories'

export { getMetricDef, getMetricDefs } from './defineMetric'
export { getCategoryOrder, getCategoryLabels, getAllCategories, getCategory } from './categories'

export const METRIC_DEFS = getMetricDefs()

export const METRIC_CATEGORY_ORDER: readonly string[] = getCategoryOrder()

export const METRIC_CATEGORY_LABELS: Record<string, string> = getCategoryLabels()
