/**
 * The shared DISTRIBUTION layer: one distribution per category slot, plus the
 * policies every rendering of it agrees on — the data contract, the summary
 * statistics, the sort rule, the value-axis scale rule, and the pane
 * vocabulary.
 *
 * Entity-agnostic AND figure-agnostic. A slot is an AOI on the AOI Comparison
 * and an eye-movement type on the Eye-movement Comparison; a plot contributes
 * only its contract and its `DistributionAxis`, and `collectDistribution` owns
 * the rest. The mark that draws the result lives one level down, one folder per
 * figure (`./beeswarm`, and whatever the visualisation switch offers next).
 * Nothing here names an entity or a mark, and nothing here imports a Svelte
 * component — transformers can consume this layer without pulling a figure into
 * their bundle.
 *
 * Deliberately NOT in this barrel, imported by their own paths instead: the
 * figure seam (`./figure` names a component) and the screen-side sync
 * (`./screen.svelte`, `./valueAxisSync.svelte` carry runes).
 *
 * Not re-exported through `$lib/plots/shared` — import this layer as
 * `$lib/plots/shared/distribution`, and note two import rules that ARE
 * load-bearing (both were observed breaking, neither is theoretical):
 *
 *  - modules here import NARROW paths (`shared/timelineUtils`,
 *    `shared/metricResolver`, `shared/labels`), never the `$lib/plots/shared`
 *    barrel — so consuming a distribution still pulls in no components;
 *  - a plot DEFINITION imports `distributionVisualisationSection` from
 *    `./paneSection` directly, never from this barrel. Transformers import the
 *    barrel, so it is already in-flight when the plot registry evaluates a
 *    definition — and a definition CALLS the factory at module-init, so through
 *    the barrel it reads an uninitialised binding
 *    ("distributionVisualisationSection is not a function").
 */
export * from './types'
export * from './summaryStatistics'
export * from './data'
export * from './collect'
export * from './labels'
export * from './paneSection'
