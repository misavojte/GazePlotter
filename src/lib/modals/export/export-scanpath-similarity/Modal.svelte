<script lang="ts">
  import { untrack } from 'svelte'
  import type { DecimalSeparator } from '$lib/data/export'
  import { Section, ModalButtons } from '$lib/modals'
  import {
    getParticipantsGroupOptions,
    getStimuliOptions,
  } from '$lib/plots/shared'
  import type { SimilarityMethod } from '$lib/metrics'
  import type { ScanpathSimilarityItem } from '$lib/plots/scanpath-similarity/types'

  const SIMILARITY_METHODS: readonly { value: SimilarityMethod; label: string }[] = [
    { value: 'levenshtein',     label: 'Levenshtein' },
    { value: 'needlemanWunsch', label: 'Needleman-Wunsch' },
  ]
  import { getGazePlotterSession } from '$lib/session'
  import { InputCheck, InputText, Select } from '$lib/shared/components'
  import {
    createExportButtons,
    CSV_DECIMAL_SEPARATOR_OPTIONS,
    CSV_DELIMITER_OPTIONS,
    waitForExportUi,
  } from '../shared/helpers'

  interface Props {
    item?: ScanpathSimilarityItem
  }

  let { item }: Props = $props()
  const { engine, exportService, modalState } = getGazePlotterSession()
  const settings = $derived(item?.settings)

  let fileName = $state('GazePlotter-ScanpathSimilarity')
  let stimulusId = $state(
    untrack(() => settings?.stimulusId?.toString() ?? '0')
  )
  let groupId = $state(untrack(() => settings?.groupId?.toString() ?? '-1'))
  let similarityMethod = $state<SimilarityMethod>('levenshtein')
  let collapsed = $state(false)
  let delimiter = $state(',')
  let decimalSeparator = $state<DecimalSeparator>('.')
  let isExporting = $state(false)

  const stimulusOptions = $derived(getStimuliOptions(engine))

  const selectedStimulusId = $derived.by(() => {
    const value = parseInt(stimulusId, 10)
    return Number.isNaN(value) ? 0 : value
  })

  const selectedGroupId = $derived.by(() => {
    const value = parseInt(groupId, 10)
    return Number.isNaN(value) ? -1 : value
  })

  const groupOptions = $derived.by(() =>
    getParticipantsGroupOptions(engine, true, selectedStimulusId)
  )

  const methodOptions = SIMILARITY_METHODS.map(method => ({
    label: method.label,
    value: method.value,
  }))

  const canExport = $derived(fileName.trim().length > 0)

  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      await waitForExportUi()
      await exportService.exportScanpathSimilarity({
        fileName: fileName.trim(),
        stimulusId: selectedStimulusId,
        groupId: selectedGroupId,
        similarityMethod,
        collapsed,
        csvOptions: {
          delimiter,
          decimalSeparator,
        },
      })
    } finally {
      isExporting = false
    }
  }

  const exportButtons = $derived(
    createExportButtons({
      canExport,
      exportLabel: 'Export Similarity Matrix',
      isExporting,
      onCancel: () => modalState.close(),
      onExport: handleExport,
    })
  )
</script>

<div class="container">
  <Section>
    <div class="content">
      <p class="purpose-description">
        Export a scanpath similarity matrix computed from participant fixation
        sequences for the selected stimulus and group.
      </p>
    </div>
  </Section>

  <Section title="Export Settings">
    <div class="content-two-column">
      <InputText
        label="File name"
        bind:value={fileName}
        placeholder="Enter filename without extension"
      />
      <Select
        label="Stimulus"
        options={stimulusOptions}
        bind:value={stimulusId}
      />
      <Select
        label="Participant Group"
        options={groupOptions}
        bind:value={groupId}
      />
      <Select
        label="Similarity Method"
        options={methodOptions}
        bind:value={similarityMethod}
      />
      <Select
        label="Delimiter"
        options={CSV_DELIMITER_OPTIONS}
        bind:value={delimiter}
      />
      <Select
        label="Decimal Separator"
        options={CSV_DECIMAL_SEPARATOR_OPTIONS}
        bind:value={decimalSeparator}
      />
    </div>

    <div class="content-row">
      <InputCheck
        label="Collapse consecutive AOIs"
        appearance="compact"
        checked={collapsed}
        onchange={event => {
          collapsed = event.detail
        }}
      />
    </div>
  </Section>

  <Section title="Format Details">
    <div class="content">
      <p class="format-description">
        <strong>Similarity matrix CSV</strong> with rows and columns for each participant.
        Values range from 0 to 1, where 1 represents identical scanpaths. The first
        two columns include participant IDs and labels for easier joins.
      </p>
    </div>
  </Section>

  <ModalButtons buttons={exportButtons} />
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    max-width: 620px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .purpose-description {
    margin: 0;
    color: var(--c-text);
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .content-two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .content-row {
    margin-top: 0.75rem;
  }

  @media (max-width: 500px) {
    .content-two-column {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }

  .format-description {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }
</style>
