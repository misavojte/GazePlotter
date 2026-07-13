import type { Component } from 'svelte'
import type {
  PaneSection,
  SchemaPaneSectionEntry,
  SectionFieldAction,
  SectionFieldCtx,
} from '$lib/plots/definePlot'
import type { ModalDefinition } from '$lib/modals/defineModal'
import { getStimuliOptions, getParticipantOptions, getParticipantsGroupOptions } from '$lib/plots/shared'
import { resolvePlotDefinition } from '$lib/plots/registry'
import { multiSelectMetricHandlers, singleSelectMetricHandlers } from '$lib/plots/shared/metricInstanceHandlers'
import {
  stimulusModificationModal,
  participantModificationModal,
  participantsGroupsModal,
  aoiModificationModal,
  eventChannelModificationModal,
  categoryModificationModal,
  metricLibraryModal,
} from '$lib/modals/definitions'
import TimelineRangeSection from '../TimelineRangeSection.svelte'

export type SharedPaneSection = PaneSection | SchemaPaneSectionEntry

/** Every shared action is "open a library modal with command provenance". */
const modalAction = (
  label: string,
  modal: ModalDefinition<Component<any>, any>,
  extra?: (ctx: SectionFieldCtx) => Record<string, unknown>
): SectionFieldAction => ({
  label,
  onclick: ctx => {
    void ctx.modalState.open(modal, { source: ctx.source, ...extra?.(ctx) })
  },
})

/**
 * Every shared pane section a definition may reference by bare key — the ONLY
 * home of cross-plot sections (definitions are data; see `PaneSectionEntry`).
 * All are schema entries rendered by `SchemaSection` except `timelineRange`,
 * which stays a component (it swaps WHICH settings keys it writes in ordinal
 * mode — inexpressible under the pane layout cap's static field keys).
 */
export const SHARED_SECTIONS: Record<string, SharedPaneSection> = {
  stimulus: {
    key: 'stimulus',
    title: 'Stimulus',
    defaultOpen: true,
    fields: [
      {
        kind: 'enum',
        key: 'stimulusId',
        valueKind: 'number',
        options: ctx => getStimuliOptions(ctx.engine),
        actions: [modalAction('Edit stimulus library', stimulusModificationModal)],
      },
    ],
  },
  participant: {
    key: 'participant',
    title: 'Participant',
    fields: [
      {
        kind: 'enum',
        key: 'participantId',
        valueKind: 'number',
        options: ctx => getParticipantOptions(ctx.engine),
        actions: [modalAction('Edit participant library', participantModificationModal)],
      },
    ],
  },
  group: {
    key: 'group',
    title: 'Participants',
    fields: [
      {
        kind: 'enum',
        key: 'groupId',
        valueKind: 'number',
        // Group options depend on a stimulus, but group ids are
        // stimulus-independent, so the representative's stimulus is safe even
        // across mixed stimuli.
        options: ctx =>
          getParticipantsGroupOptions(ctx.engine, true, (ctx.settings.stimulusId as number) ?? 0),
        actions: [
          modalAction('Edit groups', participantsGroupsModal),
          modalAction('Edit participant library', participantModificationModal),
        ],
      },
    ],
  },
  // AOIs / events / categories are engine data (not per-plot settings): the
  // sections are informational, and the modal edits globally via the
  // representative's stimulus where one is needed.
  aoi: {
    key: 'aoi',
    title: 'Areas of Interest',
    fields: [
      {
        kind: 'info',
        description: 'Areas of Interest (AOIs) map fixations to specific target regions on the stimulus. Editing the library updates display names, colors, and active visibility globally across all plots.',
        actions: [
          modalAction('Configure AOI Library', aoiModificationModal, ctx => ({
            selectedStimulus: String(ctx.settings.stimulusId),
          })),
        ],
      },
    ],
  },
  event: {
    key: 'event',
    title: 'Events',
    fields: [
      {
        kind: 'info',
        description: 'Configure events mapped to the stimulus. Editing the library updates display names, colors, and active visibility globally.',
        actions: [
          modalAction('Configure Event Library', eventChannelModificationModal, ctx => ({
            selectedStimulus: String(ctx.settings.stimulusId),
          })),
        ],
      },
    ],
  },
  eyeMovement: {
    key: 'eyeMovement',
    title: 'Eye-movement Type',
    fields: [
      {
        kind: 'info',
        description: 'Configure eye-movement classification categories (e.g. Saccades, Blinks). Editing the library updates display names, colors, and active visibility globally.',
        actions: [modalAction('Configure Category Library', categoryModificationModal)],
      },
    ],
  },
  metric: {
    key: 'metric',
    title: 'Metric',
    summary: ctx => {
      const state = ctx.common(s => (s.metricInstanceIds as string[] | undefined) ?? [])
      if (state.mixed) return 'Mixed (varies)'
      const lib = ctx.engine.metadata?.metricInstances ?? []
      const picked = state.value
        .map(id => lib.find(i => i.id === id))
        .filter((x): x is (typeof lib)[number] => !!x)
      if (picked.length === 0) return ''
      if (picked.length === 1) return picked[0].label
      return `${picked[0].label} + ${picked.length - 1}`
    },
    fields: [
      {
        kind: 'metrics',
        key: 'metricInstanceIds',
        showWhen: ctx => !!resolvePlotDefinition(ctx.item.type).consumesMetrics,
        actions: [
          {
            label: 'Edit metric library',
            onclick: ctx => {
              const contract = resolvePlotDefinition(ctx.item.type).consumesMetrics
              if (!contract) return
              const state = ctx.common(s => (s.metricInstanceIds as string[] | undefined) ?? [])
              // Mixed selection: neutral empty selection; picking applies to all.
              const safeIds = state.mixed ? [] : state.value
              const handlers = contract.multiSelect
                ? multiSelectMetricHandlers(
                    ctx.engine,
                    ctx.workspace,
                    () => safeIds,
                    ids => ctx.update({ metricInstanceIds: ids })
                  )
                : singleSelectMetricHandlers(
                    ctx.engine,
                    ctx.workspace,
                    () => safeIds[0] ?? null,
                    id => ctx.update({ metricInstanceIds: id == null ? [] : [id] })
                  )
              void ctx.modalState.open(metricLibraryModal, { contract, ...handlers })
            },
          },
        ],
      },
    ],
  },
  timelineRange: TimelineRangeSection as unknown as PaneSection,
}

/**
 * The section keys a mixed-type bulk pane may render for `types`: every shared
 * key, minus `metric` unless all types consume metrics under an IDENTICAL
 * contract — the pane filters and writes through the representative's
 * contract, so any divergence would let one type's edit violate another's.
 */
export function crossTypeSectionKeys(types: readonly string[]): ReadonlySet<string> {
  const keys = new Set(Object.keys(SHARED_SECTIONS))
  const contracts = types.map(t => resolvePlotDefinition(t).consumesMetrics)
  const first = contracts[0]
  const metricsCompatible = contracts.every(
    c =>
      !!c &&
      !!first &&
      (c.multiSelect ?? false) === (first.multiSelect ?? false) &&
      c.windowing === first.windowing &&
      c.crossParticipant === first.crossParticipant &&
      JSON.stringify(c.outputShape) === JSON.stringify(first.outputShape)
  )
  if (!metricsCompatible) keys.delete('metric')
  return keys
}
