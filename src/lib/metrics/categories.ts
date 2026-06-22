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

// ─── Seeded categories ──────────────────────────────────────────────────────
// The metric categories shipped with GazePlotter. `order` drives the sidebar
// sort in the metric-library modal. `binary` (dichotomous detection: whether an
// AOI was fixated/noticed) sits next to `ttf` — they are the "whether" and "when"
// of attention capture — and is the home for future binary metrics.

defineCategory({ id: 'duration',     label: 'Duration',               order: 0 })
defineCategory({ id: 'counts',       label: 'Counts',                 order: 1 })
defineCategory({ id: 'ttf',          label: 'Time to first fixation', order: 2 })
defineCategory({ id: 'binary',       label: 'Binary detection',       order: 3 })
defineCategory({ id: 'rqa-aoi',      label: 'RQA (AOI-based)',        order: 4 })
defineCategory({ id: 'transition',   label: 'Transitions',            order: 5 })
defineCategory({ id: 'scanpath',     label: 'Scanpath structure',     order: 6 })

export function listCategories(): MetricCategoryDef[] {
  return [..._cats.values()].sort((a, b) => a.order - b.order)
}

export function getCategoryLabels(): Record<string, string> {
  return Object.fromEntries(listCategories().map(c => [c.id, c.label]))
}
