import './init'
export { getMetric, listMetrics } from './core/defineMetric'
import { listMetrics } from './core/defineMetric'
import type { Metric } from './core/dsl'

export function listByCategory(categoryId: string): Metric[] {
  return listMetrics().filter(m => m.meta.category === categoryId)
}

export { listCategories, getCategory, defineCategory, getCategoryOrder, getCategoryLabels } from './categories'
export type { MetricCategoryDef } from './categories'
