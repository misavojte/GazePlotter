<script lang="ts">
  import { InputColor, InputText, Select } from '$lib/shared/components'
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { useTooltipAction } from '$lib/tooltip'

  const tooltipAction = useTooltipAction()
  import { getAllAois, getStimuli, getAoiSelections } from '$lib/data/engine'
  import { getStimuliOptions } from '$lib/plots/shared'
  import type {
    NameSelection,
    ExtendedInterpretedDataType,
  } from '$lib/data/types'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import SelectionTray from '../shared/SelectionTray.svelte'
  import { createGroupedEntityEditor } from '../shared/groupedEntityEditor.svelte'
  import { createSelectionSession } from '../shared/selectionSession.svelte'
  import {
    buildRenameMap,
    nameKeyedMembership,
    nameKeyedInertIds,
    nameKeyedChips,
    cloneNameSelections,
    canonicalNameSelections,
    commitNameSelections,
    stagedDomainNames,
  } from '../shared/nameKeyedSelection'
  import { referencedSelectionIds } from '../shared/selectionAdapters'
  import {
    allStimuliRenamePairs,
    buildAllStimuliUnion,
    planAllStimuliUpdates,
    resolveAllStimuliEdits,
  } from './allStimuli'

  export interface Props {
    selectedStimulus?: string
    source: string
  }

  let { selectedStimulus = '0', source }: Props = $props()
  const { engine, grid, modalState, toastState, workspace } = getGazePlotterSession()

  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  // ── Scope: ONE compact select in the list header — a stimulus, or all ─────
  // Visible stimuli only (a merge tombstones its members); captured once and
  // shared by the union, the save plan, and the staged-name domain.
  const stimuli = getStimuli(engine)
  const stimuliOptions = getStimuliOptions(engine)
  const scopeOptions = [
    { value: 'all', label: 'All stimuli' },
    ...stimuliOptions,
  ]
  // The opener's stimulus is only the STARTING scope; `scope` owns it after.
  // svelte-ignore state_referenced_locally
  let scope = $state(
    stimuliOptions.some(o => o.value === selectedStimulus)
      ? selectedStimulus
      : (stimuliOptions[0]?.value ?? 'all')
  )
  const scopeStimulusId = () => {
    const id = parseInt(scope)
    // Not a stimulus (the all scope): the first VISIBLE stimulus, not id 0,
    // which may be tombstoned by a merge or absent.
    return Number.isNaN(id) ? parseInt(stimuliOptions[0]?.value ?? '0') : id
  }

  // ── Per-stimulus editor (order, rename-to-merge, color) ───────────────────
  const stimulusEditor = createGroupedEntityEditor({
    getItems: stimulusId => getAllAois(engine, stimulusId),
    initialStimulusId: scopeStimulusId(),
  })

  // The displayed name each item had when this scope was (re)entered — the
  // stable key space selections store their members in (see renameMap).
  let stimOpenNames = $state(
    new Map(getAllAois(engine, scopeStimulusId()).map(a => [a.id, a.displayedName]))
  )

  // ── All-stimuli editor: one synthetic row per ORIGINAL name ───────────────
  // Same grouped machinery as the per-stimulus list (rename-to-merge preview,
  // color, sort) over the cross-stimulus union; the per-field semantics (an
  // edited name or color is applied to every stimulus with that original
  // name, untouched fields keep their per-stimulus values) live in
  // allStimuli.ts. Rebuilt from the engine on every switch into the scope so
  // a pushed step cannot leave the union stale.
  const perStimulus = () =>
    stimuli.map(s => ({ stimulusId: s.id, aois: getAllAois(engine, s.id) }))
  let all = buildAllStimuliUnion(perStimulus())
  let allOpenById = new Map(all.rows.map(r => [r.id, r.displayedName]))
  const allEditor = createGroupedEntityEditor({
    getItems: () => all.rows,
  })
  // Which fields the user edited, by original name — the ONE predicate behind
  // the live rename map and staged-name domain (Apply recomputes it fresh).
  const allEdits = $derived(
    resolveAllStimuliEdits(allEditor.getCleanedItems(), all.init, allEditor.touched)
  )

  const activeEditor = $derived(scope === 'all' ? allEditor : stimulusEditor)

  const ORIGINAL_TIP =
    'The AOI name from the imported recording. It never changes.'
  const DISPLAYED_TIP =
    'The name plots show. Giving two rows the same displayed name merges them into one AOI.'
  const STIM_COLUMNS = [
    {
      label: 'Move',
      width: '28px',
      type: 'handle' as const,
      tooltip: 'Drag to reorder. Order drives legends and stacked plots.',
    },
    { label: 'Original', width: '1fr', type: 'readonly' as const, key: 'originalName', tooltip: ORIGINAL_TIP },
    { label: 'Displayed', width: '1fr', type: 'text' as const, key: 'displayedName', tooltip: DISPLAYED_TIP },
    { label: 'Color', width: '40px', type: 'color' as const, align: 'center' as const },
  ]
  // Reordering here RECONCILES: rearranging the union (drag or sort) makes
  // every stimulus adopt the shared order on Apply. "Stimuli" = in how many
  // stimuli the original name appears; "*" flags per-stimulus divergence an
  // edit would unify.
  const ALL_COLUMNS = [
    {
      label: 'Move',
      width: '28px',
      type: 'handle' as const,
      tooltip:
        'Drag to set one shared order; on Apply every stimulus adopts it. Order drives legends and stacked plots.',
    },
    { label: 'Original', width: '1fr', type: 'readonly' as const, key: 'originalName', tooltip: ORIGINAL_TIP },
    { label: 'Displayed', width: '1fr', type: 'text' as const, key: 'displayedName', tooltip: DISPLAYED_TIP },
    { label: 'Color', width: '40px', type: 'color' as const, align: 'center' as const },
    {
      label: 'Stimuli',
      width: '64px',
      type: 'readonly' as const,
      key: 'stimuliLabel',
      align: 'center' as const,
      tooltip:
        'In how many of the stimuli this original AOI appears. * = its name or color currently differs between stimuli; a name or color you edit (even to the value shown) is applied to all of them, a field you leave alone keeps its per-stimulus values.',
    },
  ]
  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]
  const activeColumns = $derived(scope === 'all' ? ALL_COLUMNS : STIM_COLUMNS)
  const footerTemplate = $derived(activeColumns.map(c => c.width).join(' '))

  // ── No-AOI treatment (pinned footer row) ──────────────────────────────────
  let noAoiTreatment = $state({
    displayedName: meta.noAoiTreatment.displayedName,
    color: meta.noAoiTreatment.color,
  })
  const noAoiSnapshot = {
    displayedName: meta.noAoiTreatment.displayedName,
    color: meta.noAoiTreatment.color,
  }

  // ── AOI selections: global, name-keyed sets of displayed names ────────────
  // Members are stored in OPEN-name space (the names at scope entry) and read
  // through `renameMap` (open → current staged name; see nameKeyedSelection).
  // Staged renames are never written into the selections while typing, so
  // transient names (backspace-to-empty, collisions mid-word) cannot corrupt
  // membership; Apply commits through the same map once. The open-name source is
  // scope-dependent: the synthetic union names for "all", per-stimulus otherwise.
  const openNameOf = (id: number) =>
    (scope === 'all' ? allOpenById : stimOpenNames).get(id)
  const renameMap = $derived(
    scope === 'all'
      ? // Every per-stimulus displayed name of an edited original maps to the
        // new name, so selections follow the unification; identity pairs keep
        // still-live names from being captured (see allStimuliRenamePairs).
        buildRenameMap(allStimuliRenamePairs(all, allEdits))
      : buildRenameMap(
          stimulusEditor.items.map(
            i => [openNameOf(i.id), i.displayedName] as const
          )
        )
  )
  const session = createSelectionSession<NameSelection>({
    initial: cloneNameSelections(getAoiSelections(engine)),
    reservedIds: () => referencedSelectionIds(grid.items, 'aoiSelectionId'),
    groups: () => activeEditor.groups,
    inertIds: () => inertIds,
    ...nameKeyedMembership({ renameMap: () => renameMap, openNameOf }),
    // Arrows (not method references) so the scope switch late-binds the editor.
    renameItem: (item, name, isLeader, group) =>
      activeEditor.handleNameInput(item, name, isLeader, group),
    reorderGroups: (from, to, withIds) =>
      activeEditor.reorderGroups(from, to, withIds),
    notify: msg => toastState.addInfo(msg),
  })

  const selectionsSnapshot = canonicalNameSelections(getAoiSelections(engine))

  // Which displayed names will exist post-apply (see stagedDomainNames); the
  // "all" scope stages by ORIGINAL name, so each AOI resolves through the
  // union's edited fields instead of a per-stimulus staged list.
  const domainNames = $derived.by(() => {
    if (scope !== 'all') {
      return stagedDomainNames(
        stimuli,
        scopeStimulusId(),
        stimulusEditor.items,
        id => getAllAois(engine, id)
      )
    }
    const set = new Set<string>()
    for (const { aois } of perStimulus()) {
      for (const a of aois) {
        const t = (allEdits.get(a.originalName)?.displayedName ?? a.displayedName).trim()
        if (t) set.add(t)
      }
    }
    return set
  })

  // Cards with an empty displayed name cannot ring or toggle while editing a
  // saved selection (name-keyed membership cannot represent them).
  const inertIds = $derived(nameKeyedInertIds(activeEditor.groups))

  // ONE scope-lifecycle rule: the visible scope is the only staged scope.
  // Switching scopes discards the leaving scope's unapplied list edits by
  // re-pulling from the engine — visibly, right away — so Apply can never
  // silently drop edits staged behind an inactive scope. Synchronous (in the
  // change handler, before render) so the keyed list never paints one stale
  // frame and animates the swap.
  const changeScope = (next: string) => {
    if (next === scope) return
    session.clearTransient()
    if (next === 'all') {
      all = buildAllStimuliUnion(perStimulus())
      allOpenById = new Map(all.rows.map(r => [r.id, r.displayedName]))
      allEditor.refresh()
    } else {
      const id = parseInt(next)
      stimulusEditor.refresh(id)
      stimOpenNames = new Map(
        getAllAois(engine, id).map(a => [a.id, a.displayedName])
      )
    }
    scope = next
  }

  const chips = $derived(nameKeyedChips(session, renameMap, domainNames, 'AOIs'))

  // ── Save ──────────────────────────────────────────────────────────────────
  const itemsSignature = (items: ExtendedInterpretedDataType[]): string =>
    JSON.stringify(items.map(i => [i.id, i.displayedName, i.color]))

  function saveStimulusScope(): boolean {
    const stimulusId = scopeStimulusId()
    const cleaned = stimulusEditor.getCleanedItems()
    // No-op guard: an untouched list must not push an undo step.
    if (itemsSignature(cleaned) === itemsSignature(getAllAois(engine, stimulusId))) {
      return true
    }
    return workspace.apply({
      type: 'updateAois',
      updates: [{ stimulusId, aois: cleaned }],
      source,
    })
  }

  function saveAllScope(): boolean {
    // ONE command carrying every changed stimulus: a single undo step, one
    // toast, and no half-applied dataset if anything refuses. The per-field
    // rules (edited fields unify, untouched fields keep per-stimulus values,
    // order reconciliation only when the rows were rearranged) are
    // allStimuli.ts's; edits are recomputed here rather than read from the
    // derived so a same-value color re-pick is never missed.
    const cleaned = allEditor.getCleanedItems()
    const edits = resolveAllStimuliEdits(cleaned, all.init, allEditor.touched)
    const updates = planAllStimuliUpdates(perStimulus(), cleaned, edits)
    if (updates.length === 0) return true
    return workspace.apply({ type: 'updateAois', updates, source })
  }

  const handleSubmit = () => {
    // Selections commit through the SAME map the session displayed — resolve
    // BEFORE the AOI commands rebuild the open-name baseline underneath us.
    // No pruning: a name unmatched today may match other stimuli or return;
    // the resolver ignores unknown names and counts stay domain-honest.
    const committed = commitNameSelections(renameMap, session.selections)

    // 1. AOI edits, scoped by the header select.
    if (scope === 'all' ? !saveAllScope() : !saveStimulusScope()) return

    // 2. No-AOI treatment (only if changed).
    if (
      noAoiTreatment.displayedName !== noAoiSnapshot.displayedName ||
      noAoiTreatment.color !== noAoiSnapshot.color
    ) {
      const renamed = workspace.apply({
        type: 'updateNoAoiTreatment',
        noAoiTreatment: {
          displayedName: (noAoiTreatment.displayedName || 'No AOI').trim(),
          color: noAoiTreatment.color,
        },
        source,
      })
      if (!renamed) return
    }

    // 3. Selections, only on a real change (avoids a spurious undo step).
    if (canonicalNameSelections(committed) !== selectionsSnapshot) {
      const saved = workspace.apply({
        type: 'updateSelections',
        axis: 'aoi',
        selections: committed,
        source,
      })
      if (!saved) return
    }

    modalState.close()
  }
</script>

<Section>
  <!-- Keyed: a scope switch swaps the backing editor, whose group ids live in
       different id spaces (synthetic vs per-stimulus AOI ids). -->
  {#key scope}
    <EditableEntityList
      groups={activeEditor.groups}
      title="AOIs"
      emptyMessage={scope === 'all'
        ? 'No AOIs in this dataset'
        : 'No AOIs found in stimulus'}
      columns={activeColumns}
      sortColumns={SORT_COLUMNS}
      onSort={activeEditor.sort}
      onReorder={session.handleReorder}
      onRename={activeEditor.renameAll}
      episode={session.editingId}
      selection={session.listSelection}
      previewIds={session.previewIds}
      grouped={{
        onNameInput: activeEditor.handleNameInput,
        onColorInput: activeEditor.handleColorInput,
      }}
    >
      {#snippet titleExtra()}
        <div
          class="scope-select"
          use:tooltipAction={{
            content:
              'What the list edits: one stimulus, or every stimulus at once (a name or color you edit applies to every stimulus with that original name; fields you leave alone keep their per-stimulus values). Switching discards unapplied list edits.',
            position: 'bottom',
          }}
        >
          <Select
            label=""
            ariaLabel="Editing scope"
            compact={true}
            options={scopeOptions}
            value={scope}
            onchange={e => changeScope(e.detail as string)}
          />
        </div>
      {/snippet}
      {#snippet footer()}
        <div class="noaoi-row" style:grid-template-columns={footerTemplate}>
          <span></span>
          <span
            class="noaoi-label"
            use:tooltipAction={{
              content:
                'Fixations that hit none of the AOIs are counted here. Set how that bucket is named and colored in plots.',
            }}
          >
            No AOI
          </span>
          <div>
            <InputText
              label="No AOI display name"
              showLabel={false}
              fill={true}
              placeholder="No AOI"
              bind:value={noAoiTreatment.displayedName}
            />
          </div>
          <div class="noaoi-color">
            <InputColor
              label="No AOI color"
              showLabel={false}
              width={35}
              value={noAoiTreatment.color}
              oninput={e => (noAoiTreatment.color = e.detail)}
            />
          </div>
          {#if scope === 'all'}<span></span>{/if}
        </div>
      {/snippet}
    </EditableEntityList>
  {/key}

  <SelectionTray {session} {chips} noun="AOIs" />
</Section>

<ModalButtons
  buttons={[
    { label: 'Apply', onclick: handleSubmit, variant: 'primary' },
    { label: 'Cancel', onclick: () => modalState.close() },
  ]}
/>

<style>
  .scope-select {
    width: 150px;
  }

  .noaoi-row {
    display: grid;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    background-color: var(--c-white);
  }

  .noaoi-label {
    font-size: 14px;
    color: var(--c-midgrey);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .noaoi-color {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
