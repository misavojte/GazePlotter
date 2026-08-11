export interface MetricCategoryDef {
  readonly id: string
  readonly label: string
  readonly order: number
}

const CATS_KEY = Symbol.for('gazeplotter.metrics.categories')
const _cats: Map<string, MetricCategoryDef> =
  ((globalThis as Record<symbol, unknown>)[CATS_KEY] as Map<string, MetricCategoryDef>) ??
  ((globalThis as Record<symbol, unknown>)[CATS_KEY] = new Map())

function defineCategory(cat: MetricCategoryDef): MetricCategoryDef {
  if (_cats.has(cat.id)) return _cats.get(cat.id)!
  _cats.set(cat.id, cat)
  return cat
}

// ─── Seeded categories ──────────────────────────────────────────────────────
// `order` drives the sidebar sort in the metric-library modal. `binary` sits
// next to `ttf`: they are the "whether" and the "when" of attention capture.

defineCategory({ id: 'duration',     label: 'Duration',               order: 0 })
defineCategory({ id: 'counts',       label: 'Counts',                 order: 1 })
defineCategory({ id: 'ttf',          label: 'Time to first fixation', order: 2 })
defineCategory({ id: 'binary',       label: 'Binary detection',       order: 3 })
defineCategory({ id: 'rqa-aoi',      label: 'RQA (AOI-based)',        order: 4 })
defineCategory({ id: 'transition',   label: 'Transitions',            order: 5 })
defineCategory({ id: 'scanpath',     label: 'Scanpath structure',     order: 6 })
defineCategory({ id: 'eye-movement', label: 'Eye movement',           order: 7 })

export function listCategories(): MetricCategoryDef[] {
  return [..._cats.values()].sort((a, b) => a.order - b.order)
}

