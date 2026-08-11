/**
 * The BEESWARM rendering of a category distribution: every individual value its
 * own dot along the value axis, with an overlay statistic (mean ± CI / SD, or a
 * boxplot) drawn on top, degenerating to a single proportional bar for rate
 * metrics that have no distribution to swarm.
 *
 * One figure among the distribution renderings the visualisation switch
 * offers, so this level IS named by its mark — picking a figure here is
 * exactly picking a mark. The measure layer it consumes (the data contract,
 * the statistics, the sort/scale policy, the pane vocabulary) is entity- and
 * figure-agnostic and lives one level up in `$lib/plots/shared/distribution`.
 */
export { default as BeeswarmFigure } from './BeeswarmFigure.svelte'
export * from './figureProps'
export * from './renderers'
