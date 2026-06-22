<script lang="ts">
  import InputText from '$lib/shared/components/InputText.svelte'
  import Radio from '$lib/shared/components/Radio.svelte'
  import Select from '$lib/shared/components/Select.svelte'
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import type { IntervalDraftPreview } from '$lib/data/engine'
  import {
    buildEventDataWithIntervalChannels,
    buildEventDataWithoutChannels,
    detectSuffixPair,
    getEventChannelSummary,
    previewIntervalDrafts,
    proposePairsBySuffix,
  } from '$lib/data/engine'
  import type { DraftRow, ErrorPairPolicy } from './drafts'
  import {
    defaultManualName,
    reconcileDraftRows,
    rowIncludable,
  } from './drafts'

  interface Props {
    source: string
  }

  const { source }: Props = $props()
  const { engine, modalState, workspace, toastState } = getGazePlotterSession()

  // Deleting a created interval mutates the engine while the modal stays
  // open, so the channel view is reactive state re-pulled after each
  // deletion. The suffix detection prefill runs once, on the initial view.
  const initialSummary = getEventChannelSummary(engine)
  let summary = $state(initialSummary)
  const channelNames = $derived(summary.map(entry => entry.name))
  const occurrencesByName = $derived(
    new Map(summary.map(entry => [entry.name, entry.occurrenceCount]))
  )
  const channelOptions = $derived(
    channelNames.map(name => ({ value: name, label: name }))
  )
  const createdIntervals = $derived(summary.filter(entry => entry.isInterval))
  const detected = detectSuffixPair(
    initialSummary.map(entry => entry.name),
    new Map(initialSummary.map(entry => [entry.name, entry.firstOnset]))
  )
  const MAX_DETAIL_LINES = 3

  const POLICY_OPTIONS = [
    { value: 'skip', label: 'Skip the whole pair' },
    { value: 'lenient', label: 'Create valid intervals only' },
  ]

  let startSuffix = $state(detected?.startSuffix ?? '')
  let endSuffix = $state(detected?.endSuffix ?? '')
  let rows = $state<DraftRow[]>(
    reconcileDraftRows(
      [],
      detected
        ? proposePairsBySuffix(
            initialSummary.map(entry => entry.name),
            detected.startSuffix,
            detected.endSuffix
          ).proposals
        : []
    )
  )
  let policy = $state<ErrorPairPolicy>('skip')
  let manualStart = $state('')
  let manualEnd = $state('')
  let manualName = $state('')
  // Deletions change the data without closing the modal — Back must then
  // resolve truthy so hosts re-pull their lists.
  let mutated = false

  const oneSided = $derived(
    proposePairsBySuffix(channelNames, startSuffix, endSuffix).oneSided
  )
  const oneSidedStarts = $derived(
    oneSided.filter(name => name.endsWith(startSuffix))
  )
  const oneSidedEnds = $derived(
    oneSided.filter(name => name.endsWith(endSuffix))
  )

  const addManualPairFromOneSided = (start: string, end: string) => {
    rows = [
      ...rows,
      {
        draft: {
          name: defaultManualName(start, end),
          startName: start,
          endName: end,
        },
        origin: 'manual',
        checked: true,
      },
    ]
  }
  const previews = $derived(
    previewIntervalDrafts(
      engine,
      rows.map(row => row.draft)
    )
  )
  const includedCount = $derived(
    rows.filter((row, i) => row.checked && rowIncludable(previews[i], policy))
      .length
  )

  const regenerateProposals = () => {
    rows = reconcileDraftRows(
      rows,
      proposePairsBySuffix(channelNames, startSuffix, endSuffix).proposals
    )
  }

  const manualNamePlaceholder = $derived(
    manualStart && manualEnd ? defaultManualName(manualStart, manualEnd) : ''
  )
  const canAddManual = $derived(
    manualStart !== '' && manualEnd !== '' && manualStart !== manualEnd
  )

  const addManualPair = () => {
    if (!canAddManual) return
    rows = [
      ...rows,
      {
        draft: {
          name: manualName.trim() || defaultManualName(manualStart, manualEnd),
          startName: manualStart,
          endName: manualEnd,
        },
        origin: 'manual',
        checked: true,
      },
    ]
    manualStart = ''
    manualEnd = ''
    manualName = ''
  }

  const removeRow = (index: number) => {
    rows = rows.filter((_, i) => i !== index)
  }

  const occurrencesFor = (row: DraftRow) =>
    `${occurrencesByName.get(row.draft.startName) ?? 0} + ${occurrencesByName.get(row.draft.endName) ?? 0}`

  const statusFor = (preview: IntervalDraftPreview): string => {
    if (preview.skippedCount === 0) return `✓ ${preview.pairedCount}`
    if (policy === 'lenient') {
      return `⚠ ${preview.pairedCount} paired · ${preview.skippedCount} skipped`
    }
    return `✗ ${preview.skippedCount} error${preview.skippedCount === 1 ? '' : 's'}`
  }

  const describeDetail = (preview: IntervalDraftPreview, index: number) => {
    const error = preview.errors[index]
    const where = `${error.stimulus} · ${error.participant} at ${(error.timeMs / 1000).toFixed(2)} s`
    const what =
      error.kind === 'double-start'
        ? `'${error.startChannel}' (${where}): a new start occurred while one was still open`
        : error.kind === 'orphan-end'
          ? `'${error.endChannel}' (${where}): an end occurred with no open start`
          : `'${error.startChannel}' (${where}): started but never ended`
    return policy === 'lenient' ? `${what} — skipped` : what
  }

  const handleCreate = () => {
    const drafts = rows
      .filter((row, i) => row.checked && rowIncludable(previews[i], policy))
      .map(row => row.draft)
    if (drafts.length === 0) return
    const updates = buildEventDataWithIntervalChannels(engine, drafts)
    // One plain `updateEventData` command per affected stimulus — the
    // undo layer only ever sees "events changed".
    for (const update of updates) {
      workspace.updateEventData(
        update.stimulusId,
        update.channelDefs,
        update.eventBuffers,
        source,
        update.hiddenChannels
      )
    }
    toastState.addSuccess(
      `Created ${drafts.length} interval channel${drafts.length === 1 ? '' : 's'}`
    )
    // Resolve `true` so the host modal knows the data changed underneath
    // it; an untouched Back resolves `null` via plain close().
    modalState.finish(true)
  }

  // Structural reversal: drop the derived channel everywhere. Sources
  // were never modified, so nothing needs restoring.
  const handleDelete = (name: string) => {
    for (const update of buildEventDataWithoutChannels(
      engine,
      new Set([name])
    )) {
      workspace.updateEventData(
        update.stimulusId,
        update.channelDefs,
        update.eventBuffers,
        source,
        update.hiddenChannels
      )
    }
    mutated = true
    summary = getEventChannelSummary(engine)
    toastState.addSuccess(`Deleted interval channel '${name}'`)
  }

  const handleBack = () => {
    if (mutated) modalState.finish(true)
    else modalState.close()
  }
</script>

<Section>
  {#if channelNames.length === 0}
    <p class="description">No event channels found in the loaded data.</p>
  {:else}
    <p class="description">
      Pair a start event with the event that ends it to derive a new
      interval channel from their onsets. Pairs are checked across every
      stimulus and participant; the original channels stay untouched.
    </p>

    <Section title="A. Detect pairs by name suffix">
      <div class="suffix-inputs-grid">
        <InputText
          bind:value={startSuffix}
          label="Start suffix"
          placeholder="-0"
          fill={true}
        />
        <InputText
          bind:value={endSuffix}
          label="End suffix"
          placeholder="-1"
          fill={true}
        />
      </div>
      <p class="suffix-tip">
        Note: Event channels must share a common prefix (base) to be automatically paired by suffix.
      </p>
      {#if oneSided.length > 0}
        <div class="one-sided-section">
          <p class="one-sided">
            Matched on one side only: {oneSided.join(', ')}
          </p>
          {#if oneSidedStarts.length > 0 && oneSidedEnds.length > 0}
            <div class="quick-pairs">
              <span class="quick-pair-label">Quick pair unmatched:</span>
              {#each oneSidedStarts as start}
                {#each oneSidedEnds as end}
                  <button
                    class="quick-pair-button"
                    onclick={() => addManualPairFromOneSided(start, end)}
                  >
                    {start} → {end}
                  </button>
                {/each}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <div class="action-row">
        <button
          class="add-button"
          onclick={regenerateProposals}
          disabled={!startSuffix || !endSuffix}
        >
          Add
        </button>
      </div>
    </Section>

    <Section title="B. Add pair manually">
      <div class="inputs-grid manual-inputs-grid">
        <Select
          compact
          label="Start event"
          placeholder="Start event"
          options={channelOptions}
          value={manualStart}
          onchange={event => (manualStart = event.detail as string)}
        />
        <Select
          compact
          label="End event"
          placeholder="End event"
          options={channelOptions}
          value={manualEnd}
          onchange={event => (manualEnd = event.detail as string)}
        />
        <InputText
          bind:value={manualName}
          label="New channel name"
          placeholder={manualNamePlaceholder || 'Name'}
          fill={true}
        />
      </div>
      <div class="action-row">
        <button
          class="add-button"
          disabled={!canAddManual}
          onclick={addManualPair}
        >
          Add
        </button>
      </div>
    </Section>

    {#if rows.length > 0}
      <Section title="Intervals to create">
        <div class="pair-list">
          <div class="pair-row header">
            <span></span>
            <span>New channel</span>
            <span>From → To</span>
            <span>Occurrences</span>
            <span>Status</span>
            <span></span>
          </div>
          {#each rows as row, i (row)}
            {@const preview = previews[i]}
            {@const includable = rowIncludable(preview, policy)}
            <div class="pair-row" class:excluded={!includable}>
              <input
                type="checkbox"
                checked={row.checked && includable}
                disabled={!includable}
                onchange={event => {
                  row.checked = (event.currentTarget as HTMLInputElement).checked
                }}
                aria-label={`Include ${row.draft.name}`}
              />
              <div class="name-cell" class:name-error={preview.nameError}>
                <InputText
                  bind:value={row.draft.name}
                  label={`Name for ${row.draft.startName}`}
                  showLabel={false}
                  fill
                />
              </div>
              <span class="from-to" title={`${row.draft.startName} → ${row.draft.endName}`}>
                {row.draft.startName} → {row.draft.endName}
              </span>
              <span class="counts">{occurrencesFor(row)}</span>
              <span
                class="status"
                class:status-ok={preview.skippedCount === 0 && !preview.nameError}
                class:status-bad={!includable}
              >
                {preview.nameError ?? statusFor(preview)}
              </span>
              <button
                class="remove-button"
                onclick={() => removeRow(i)}
                aria-label={`Remove pair ${row.draft.name}`}
              >
                ×
              </button>
              {#if preview.errors.length > 0}
                <div class="details">
                  {#each preview.errors.slice(0, MAX_DETAIL_LINES) as _, j}
                    <div class="detail-line">{describeDetail(preview, j)}</div>
                  {/each}
                  {#if preview.errors.length > MAX_DETAIL_LINES}
                    <div class="detail-line">
                      +{preview.errors.length - MAX_DETAIL_LINES} more
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <div class="options-row">
          <Radio
            legend="Pairs with errors"
            appearance="compact"
            direction="row"
            options={POLICY_OPTIONS}
            value={policy}
            onchange={event => (policy = event.detail as ErrorPairPolicy)}
          />
        </div>
      </Section>
    {/if}

    <Section title="Created interval channels">
      {#if createdIntervals.length > 0}
        <div class="created-list">
          {#each createdIntervals as entry (entry.name)}
            <div class="created-row">
              <span class="created-name">{entry.name}</span>
              <span class="created-count">
                {entry.occurrenceCount} interval{entry.occurrenceCount === 1
                  ? ''
                  : 's'}
              </span>
              <button
                class="remove-button"
                onclick={() => handleDelete(entry.name)}
                aria-label={`Delete interval channel ${entry.name}`}
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-message">No interval channels created yet.</p>
      {/if}
    </Section>
  {/if}
</Section>

<ModalButtons
  buttons={channelNames.length === 0
    ? [{ label: 'Back', onclick: handleBack }]
    : [
        {
          label: `Create ${includedCount} interval${includedCount === 1 ? '' : 's'}`,
          onclick: handleCreate,
          variant: 'primary',
          isDisabled: includedCount === 0,
        },
        { label: 'Back', onclick: handleBack },
      ]}
/>

<style>
  .description {
    margin: 0 0 0.75rem 0;
    color: var(--c-text);
    font-size: 0.9rem;
    line-height: 1.4;
  }



  .created-list {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
  }

  .created-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) auto 24px;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.6rem;
  }

  .created-row + .created-row {
    border-top: 1px solid var(--c-grey);
  }

  .created-name {
    font-size: 12.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .created-count {
    font-size: 12px;
    color: var(--c-darkgrey);
    white-space: nowrap;
  }



  .inputs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .suffix-inputs-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 140px));
    gap: 0.75rem;
  }

  .manual-inputs-grid {
    grid-template-columns: 1fr 1fr 1.2fr;
  }

  .action-row {
    display: flex;
    justify-content: flex-start;
    margin-top: 0.25rem;
  }

  .one-sided {
    margin: 0.4rem 0 0 0;
    font-size: 12px;
    color: var(--c-warning);
  }

  .pair-list {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 0.75rem;
  }

  .pair-row {
    display: grid;
    grid-template-columns: 24px minmax(120px, 1fr) minmax(0, 1.4fr) auto auto 24px;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.6rem;
    min-height: 40px;
  }

  .pair-row + .pair-row {
    border-top: 1px solid var(--c-grey);
  }

  .pair-row.header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--c-lightgrey);
    font-size: 12px;
    font-weight: 600;
    color: var(--c-darkgrey);
    min-height: 0;
    padding: 0.4rem 0.6rem;
  }

  .pair-row.excluded {
    background: color-mix(in srgb, var(--c-error) 4%, transparent);
  }

  .name-cell.name-error :global(input) {
    border-color: var(--c-error);
  }

  .from-to {
    font-size: 12.5px;
    color: var(--c-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .counts {
    font-size: 12px;
    color: var(--c-darkgrey);
    white-space: nowrap;
  }

  .status {
    font-size: 12px;
    white-space: nowrap;
  }

  .status-ok {
    color: var(--c-success);
  }

  .status-bad {
    color: var(--c-error);
  }

  .remove-button {
    background: none;
    border: none;
    color: var(--c-darkgrey);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 4px;
  }

  .remove-button:hover {
    color: var(--c-error);
  }

  .details {
    grid-column: 2 / -1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: 0.25rem;
  }

  .detail-line {
    font-size: 12px;
    line-height: 1.35;
    color: var(--c-error);
  }

  .add-button {
    border: 1px solid var(--c-border);
    background: var(--c-lightgrey);
    border-radius: var(--rounded);
    padding: 0.35rem 1.4rem;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-normal) ease;
  }

  .add-button:hover:not(:disabled) {
    background: var(--c-grey);
  }

  .add-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .options-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }



  .suffix-tip {
    margin: 0.35rem 0 0 0;
    font-size: 11.5px;
    color: var(--c-darkgrey);
    line-height: 1.3;
  }

  .one-sided-section {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .quick-pairs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .quick-pair-label {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--c-darkgrey);
  }

  .quick-pair-button {
    background: none;
    border: 1px dashed var(--c-warning);
    color: var(--c-warning);
    border-radius: var(--rounded-md);
    padding: 0.15rem 0.4rem;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast) ease-in-out;
  }

  .quick-pair-button:hover {
    background: var(--c-warning);
    color: var(--c-white);
    border-style: solid;
  }

  .empty-message {
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    text-align: center;
    margin: 1rem 0;
  }
</style>
