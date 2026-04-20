export interface MetricCategoryDef {
  readonly id: string
  readonly label: string
  readonly order: number
}

const _cats = new Map<string, MetricCategoryDef>()

export function defineCategory(cat: MetricCategoryDef): MetricCategoryDef {
  if (_cats.has(cat.id)) return _cats.get(cat.id)!
  _cats.set(cat.id, cat)
  return cat
}

export function getCategory(id: string): MetricCategoryDef | undefined {
  return _cats.get(id)
}

export function getAllCategories(): MetricCategoryDef[] {
  return [..._cats.values()].sort((a, b) => a.order - b.order)
}

export function getCategoryOrder(): string[] {
  return getAllCategories().map(c => c.id)
}

export function getCategoryLabels(): Record<string, string> {
  return Object.fromEntries(getAllCategories().map(c => [c.id, c.label]))
}
