import { deriveScanpathSimilarityView } from './core/view'
import { scanpathSimilarityScreen } from './core/screen.svelte'
import {
  cliquesOfMinSize,
  edgeSharePercent,
  getScangraphCliques,
  similarityDataFor,
  thresholdForEdgeShare,
} from './core/transformer'
import { SCANPATH_SIMILARITY_DEFAULTS } from './const'
import { definePlot, type SectionFieldCtx } from '$lib/plots/definePlot'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { PRESET_PALETTES } from '$lib/color/palettes'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import type { ScanpathSimilaritySettings } from './types'

// View-gated sub-controls hide while `view` diverges across a bulk selection.
const viewIs = (mode: string) => (ctx: SectionFieldCtx) => {
  const v = ctx.common(s => s.view ?? 'matrix')
  return !v.mixed && v.value === mode
}

// The p threshold and the edge share are one state seen from two sides: the
// share control DISPLAYS the share the current p achieves.
const readEdgeShare = (
  settings: Record<string, unknown>,
  engine: DataEngine
): number => {
  const s = settings as unknown as ScanpathSimilaritySettings
  return edgeSharePercent(
    similarityDataFor(engine, s),
    s.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold
  )
}

const NONE_CLIQUE = { label: 'None', value: 'none' }
const MAX_NAMES_IN_OPTION = 3

// The paper's clique list: one option per maximal clique of the current graph
// with at least `minCliqueSize` members. The label stays short (it is also
// the trigger text); the detail line carries the science — the clique's
// internal agreement (weakest and mean pairwise p) and its members. A
// too-dense graph (enumeration skipped) offers only 'None'.
const cliqueOptions = (ctx: SectionFieldCtx) => {
  const settings = ctx.settings as unknown as ScanpathSimilaritySettings
  const cliques = cliquesOfMinSize(
    getScangraphCliques(ctx.engine, settings),
    settings.minCliqueSize ?? 2
  )
  if (!cliques) return [NONE_CLIQUE]
  return [
    NONE_CLIQUE,
    ...cliques.map((c, i) => {
      const names = c.memberLabels.slice(0, MAX_NAMES_IN_OPTION).join(', ')
      const more = c.memberLabels.length - MAX_NAMES_IN_OPTION
      return {
        label: `Clique ${i + 1} · ${c.memberLabels.length} members`,
        detail: `p ≥ ${c.minSimilarity.toFixed(2)} · x̄ ${c.meanSimilarity.toFixed(2)} · ${names}${more > 0 ? ` +${more}` : ''}`,
        value: c.key,
      }
    }),
  ]
}

// A stored key that no longer names an offered clique reads as 'none' instead
// of a blank Select (threshold, data, or the min-members floor moved under
// the selection).
const readSelectedClique = (
  settings: Record<string, unknown>,
  engine: DataEngine
): string => {
  const key = (settings.selectedClique as string) ?? 'none'
  if (key === 'none') return 'none'
  const s = settings as unknown as ScanpathSimilaritySettings
  const cliques = cliquesOfMinSize(
    getScangraphCliques(engine, s),
    s.minCliqueSize ?? 2
  )
  return cliques?.some(c => c.key === key) ? key : 'none'
}

export const scanpathSimilarityDefinition = definePlot<
  'scanpathSimilarity',
  ScanpathSimilaritySettings
>({
  type: 'scanpathSimilarity',
  name: 'Scanpath Similarity',
  group: 'inter-participant',
  paneSections: [
    'stimulus',
    'group',
    'metric',
    {
      key: 'scanpathSimilarity:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'view',
          options: [
            { label: 'Matrix', value: 'matrix' },
            { label: 'ScanGraph', value: 'scangraph' },
          ],
          default: 'matrix',
          summary: true,
        },
        {
          kind: 'number',
          key: 'threshold',
          label: 'Similarity threshold (0–1)',
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.5,
          showWhen: viewIs('scangraph'),
          pair: true,
        },
        {
          kind: 'number',
          key: 'edgePercent',
          label: 'Edges (% of possible pairs)',
          min: 0,
          max: 100,
          step: 1,
          default: 5,
          read: readEdgeShare,
          showWhen: viewIs('scangraph'),
          pair: true,
        },
        {
          kind: 'number',
          key: 'minCliqueSize',
          label: 'Min clique members',
          min: 2,
          step: 1,
          default: 2,
          showWhen: viewIs('scangraph'),
        },
        {
          kind: 'enum',
          key: 'selectedClique',
          label: ctx => {
            const settings = ctx.settings as unknown as ScanpathSimilaritySettings
            const cliques = cliquesOfMinSize(
              getScangraphCliques(ctx.engine, settings),
              settings.minCliqueSize ?? 2
            )
            const count = cliques?.length ?? 0
            return `Highlight clique (${count} available)`
          },
          options: cliqueOptions,
          default: 'none',
          read: readSelectedClique,
          showWhen: viewIs('scangraph'),
        },
        {
          kind: 'stimulusColorRange',
          key: 'stimuliColorValueRanges',
          inputMax: 1,
          step: 0.01,
          showWhen: viewIs('matrix'),
        },
        {
          kind: 'colorScale',
          key: 'colorScale',
          defaultMin: PRESET_PALETTES.BLUE.colors[0],
          defaultMax: PRESET_PALETTES.BLUE.colors[2],
          showWhen: viewIs('matrix'),
        },
      ],
    },
    'timelineRange',
    'aoi',
  ],
  view: { deriveView: deriveScanpathSimilarityView },
  screen: scanpathSimilarityScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    metricInstanceIds: ['participantPairSimilarity-lev'],
    view: 'matrix',
    threshold: 0.5,
    edgePercent: 5,
    minCliqueSize: 2,
    selectedClique: 'none',
    colorScale: [...PRESET_PALETTES.BLUE.colors],
    stimuliColorValueRanges: [],
  }),
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'participant-pair-matrix',
    windowing: 'forbidden',
    crossParticipant: 'group-axis',
  },
  // An 'Edges (%)' edit is the threshold expressed in edge-share space:
  // convert it to the p drawing at most that share (ties round down, per the
  // ScanGraph paper). The share control then displays the share p actually
  // achieves, so the user sees both sides of the one state move together.
  onCommand: (command, item, engine, dispatch): void => {
    // Hooks only ever see root commands, and this hook's own child touches
    // `threshold`, not `edgePercent` — the patch-shape guard alone excludes it.
    if (command.type !== 'updateSettings') return
    const patch = command.updates.find(u => u.itemId === item.id)?.settings
    if (!patch || !('edgePercent' in patch) || 'threshold' in patch) return

    const settings = item.settings
    const simData = similarityDataFor(engine, settings)
    if (simData.size < 2) return
    const p = thresholdForEdgeShare(
      simData,
      settings.edgePercent ?? SCANPATH_SIMILARITY_DEFAULTS.edgePercent
    )
    // Infinity (nothing qualifies) clamps to 1 — the paper's own floor, where
    // identical scanpaths stay connected; the derived share readout then
    // shows what was actually achieved rather than the impossible request.
    const next = Math.min(Number.isFinite(p) ? p : 1, 1)
    if (next === (settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold))
      return
    dispatch({
      type: 'updateSettings',
      updates: [{ itemId: item.id, settings: { threshold: next } }],
      source: 'plot.onCommand',
    })
  },
})
