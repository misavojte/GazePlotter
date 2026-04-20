export interface MetricCategoryDef {
  readonly id: string
  readonly label: string
  readonly order: number
}

const CATS_KEY = Symbol.for('gazeplotter.metrics.categories')
const _cats: Map<string, MetricCategoryDef> =
  ((globalThis as Record<symbol, unknown>)[CATS_KEY] as Map<string, MetricCategoryDef>) ??
  ((globalThis as Record<symbol, unknown>)[CATS_KEY] = new Map())

export function defineCategory(cat: MetricCategoryDef): MetricCategoryDef {
  if (_cats.has(cat.id)) return _cats.get(cat.id)!
  _cats.set(cat.id, cat)
  return cat
}

export function getCategory(id: string): MetricCategoryDef | undefined {
  return _cats.get(id)
}

export function listCategories(): MetricCategoryDef[] {
  return [..._cats.values()].sort((a, b) => a.order - b.order)
}

export function getCategoryOrder(): string[] {
  return listCategories().map(c => c.id)
}

export function getCategoryLabels(): Record<string, string> {
  return Object.fromEntries(listCategories().map(c => [c.id, c.label]))
}
