/**
 * The shared DISTRIBUTION layer: one distribution per category slot, plus the
 * policies every rendering of it agrees on — the data contract, the summary
 * statistics, the sort rule, the value-axis scale rule, and the pane
 * vocabulary.
 *
 * Entity-agnostic AND figure-agnostic. A slot is an AOI on the AOI Comparison
 * and an eye-movement type on the Eye-movement Comparison; the mark that draws
 * it lives one level down, one folder per figure (`./beeswarm`, and whatever
 * the visualisation switch offers next). Nothing here names an entity or a
 * mark, and nothing here imports a Svelte component — transformers can consume
 * this layer without pulling a figure into their bundle.
 *
 * NOT re-exported through `$lib/plots/shared`: this module imports that barrel,
 * so folding it back in would close an import cycle. Import it as
 * `$lib/plots/shared/distribution`.
 */
export * from './types'
export * from './summaryStatistics'
export * from './data'
export * from './labels'
