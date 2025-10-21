<script lang="ts">
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'
  import {
    GeneralSelect,
    GeneralInputText,
    GeneralInputGroup,
  } from '$lib/shared/components'
  import { SectionHeader, ModalButtons } from '$lib/modals'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import {
    getParticipantsGroups,
    getParticipantsIds,
    getAllAois,
    getParticipant,
    getStimulus
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import {
    collectParticipantsDwellTimeData,
    collectParticipantsTimeToFirstFixationData,
    collectParticipantsAvgFixationDurationData,
    collectParticipantsFirstFixationDurationData,
    collectParticipantsFixationCountData,
    collectParticipantsEntryCountData,
    collectParticipantsDwellDurationData,
  } from '$lib/plots/bar/utils/collectParticipantMetricsUtils'
  import { addSuccessToast } from '$lib/toaster/stores'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { ModalContentDownloadWorkplace } from '$lib/modals/export/components'

  interface Props {
    settings?: BarPlotGridType
  }

  let { settings }: Props = $props()

  // Export settings state
  let fileName = $state('GazePlotter-AggregatedData')
  let selectedGroupId = $state(settings?.groupId.toString() ?? '-1')
  let selectedStimuliIds = $state(
    new Set([settings?.stimulusId.toString() ?? '0'])
  )
  let isExporting = $state(false)

  // Metrics configuration and state
  // Grouped logically: Time metrics → First fixation → Fixations → Visits
  const metricsConfig = [
    // === Time Metrics ===
    {
      key: 'absoluteDwellTime' as const,
      label: 'Absolute Dwell Time',
      sublabel: 'Total time spent in each AOI (ms)',
      csvName: 'Absolute_Dwell_Time',
      collector: collectParticipantsDwellTimeData,
    },
    {
      key: 'relativeDwellTime' as const,
      label: 'Relative Dwell Time (%)',
      sublabel: 'Dwell time as percentage of total viewing time',
      csvName: 'Relative_Dwell_Time',
      collector: collectParticipantsDwellTimeData,
      processFunction: (values: number[], participantData?: any[], aoiIndex?: number) => {
        // Calculate as percentage of total viewing time
        // Total time is stored in the last index (Any_Fixation)
        if (!participantData || aoiIndex === undefined) return 0
        const dwellTime = participantData[aoiIndex] as number
        const totalTime = participantData[participantData.length - 1] as number
        return totalTime > 0 ? (dwellTime / totalTime) * 100 : 0
      },
    },
    // === First Fixation Metrics ===
    {
      key: 'timeToFirstFixation' as const,
      label: 'Time to First Fixation',
      sublabel: 'Time until first fixation on each AOI (-1 if never fixated)',
      csvName: 'Time_To_First_Fixation',
      collector: collectParticipantsTimeToFirstFixationData,
    },
    {
      key: 'firstFixationDuration' as const,
      label: 'First Fixation Duration',
      sublabel: 'Duration of the first fixation on each AOI (-1 if never fixated)',
      csvName: 'First_Fixation_Duration',
      collector: collectParticipantsFirstFixationDurationData,
    },
    // === Fixation Metrics ===
    {
      key: 'fixationCount' as const,
      label: 'Fixation Count',
      sublabel: 'Number of fixations on each AOI',
      csvName: 'Fixation_Count',
      collector: collectParticipantsFixationCountData,
    },
    {
      key: 'meanFixationDuration' as const,
      label: 'Mean Fixation Duration',
      sublabel: 'Average duration of fixations on each AOI',
      csvName: 'Mean_Fixation_Duration',
      collector: collectParticipantsAvgFixationDurationData,
      processFunction: (values: number[], _participantData?: any[], _aoiIndex?: number) =>
        values.length === 0
          ? -1
          : values.reduce((sum, val) => sum + val, 0) / values.length,
    },
    // === Visit Metrics ===
    {
      key: 'visitCount' as const,
      label: 'Visit Count',
      sublabel: 'Number of distinct visits to each AOI',
      csvName: 'Visit_Count',
      collector: collectParticipantsEntryCountData,
    },
    {
      key: 'meanVisitDuration' as const,
      label: 'Mean Visit Duration',
      sublabel: 'Average duration of visits to each AOI',
      csvName: 'Mean_Visit_Duration',
      collector: collectParticipantsDwellDurationData,
      processFunction: (values: number[], _participantData?: any[], _aoiIndex?: number) =>
        values.length === 0
          ? -1
          : values.reduce((sum, val) => sum + val, 0) / values.length,
    },
  ] as const

  type MetricKey = (typeof metricsConfig)[number]['key']

  // Metrics selection state
  let selectedMetrics = $state(
    new Set<MetricKey>(metricsConfig.map(m => m.key))
  )

  // Create metrics items for the group component
  const metricsItems = $derived(
    metricsConfig.map(config => ({
      key: config.key,
      label: config.label,
      sublabel: config.sublabel,
      checked: selectedMetrics.has(config.key),
    }))
  )

  // Handle metric selection changes
  function handleMetricChange(key: string, checked: boolean) {
    if (checked) {
      selectedMetrics.add(key as MetricKey)
    } else {
      selectedMetrics.delete(key as MetricKey)
    }
    selectedMetrics = new Set(selectedMetrics) // Trigger reactivity
  }

  // Get options for dropdowns and checkboxes
  const stimuliItems = $derived(
    getStimuliOptions().map(option => ({
      key: option.value,
      label: option.label,
      checked: selectedStimuliIds.has(option.value),
    }))
  )
  const groupOptions = $derived(
    getParticipantsGroups(true).map(group => ({
      label: group.name,
      value: group.id.toString(),
    }))
  )

  // Handle stimulus selection changes
  function handleStimulusChange(key: string, checked: boolean) {
    if (checked) {
      selectedStimuliIds.add(key)
    } else {
      selectedStimuliIds.delete(key)
    }
    selectedStimuliIds = new Set(selectedStimuliIds) // Trigger reactivity
  }

  // Validation
  const canExport = $derived(
    selectedMetrics.size > 0 &&
      fileName.trim().length > 0 &&
      selectedStimuliIds.size > 0
  )

  // Function to get AOI name for CSV
  function getAoiName(aoiIndex: number, aois: any[]): string {
    if (aoiIndex < aois.length) return aois[aoiIndex].displayedName
    if (aoiIndex === aois.length) return 'No_AOI'
    return 'Any_Fixation'
  }

  // Function to generate and download CSV
  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      // Small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 100))
      const groupId = parseInt(selectedGroupId)
      const stimuliToProcess = Array.from(selectedStimuliIds).map(id =>
        getStimulus(parseInt(id))
      )

      const csvRows = [
        'Participant_ID,Participant_Name,Stimulus,AOI_Group,Metric,Value',
      ]

      // Get selected metric configs
      const activeMetrics = metricsConfig.filter(config =>
        selectedMetrics.has(config.key)
      )

      for (const stimulus of stimuliToProcess) {
        const participantIds = getParticipantsIds(groupId, stimulus.id)
        const aois = getAllAois(stimulus.id)

        // Collect all metric data for this stimulus
        const metricsData = activeMetrics.map(config => ({
          name: config.csvName,
          data: config.collector(stimulus.id, participantIds, aois),
          processFunction:
            'processFunction' in config ? config.processFunction : undefined,
        }))

        // Generate CSV rows for each metric
        for (const metric of metricsData) {
          for (let pIndex = 0; pIndex < participantIds.length; pIndex++) {
            const participantId = participantIds[pIndex]
            const participant = getParticipant(participantId)
            const participantData = metric.data[pIndex]

            for (
              let aoiIndex = 0;
              aoiIndex < participantData.length;
              aoiIndex++
            ) {
              const aoiGroup = getAoiName(aoiIndex, aois)
              let value: number

              // Apply processFunction if defined (handles arrays or special calculations)
              if (metric.processFunction) {
                if (Array.isArray(participantData[aoiIndex])) {
                  // Array data (e.g., fixation durations, dwell durations)
                  value = metric.processFunction(
                    participantData[aoiIndex] as number[],
                    participantData,
                    aoiIndex
                  )
                } else {
                  // Scalar data but needs processing (e.g., relative time percentage)
                  value = metric.processFunction(
                    participantData[aoiIndex] as any,
                    participantData,
                    aoiIndex
                  )
                }
              } else {
                // No processing needed - use raw value
                value = participantData[aoiIndex] as number
              }

              csvRows.push(
                `${participantId},"${participant.displayedName}","${stimulus.displayedName}","${aoiGroup}","${metric.name}",${value}`
              )
            }
          }
        }
      }

      // Download CSV
      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `${fileName.trim()}.csv`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Show success message
      const totalRows = csvRows.length - 1 // Subtract header row
      const metricsCount = activeMetrics.length
      const stimuliCount = stimuliToProcess.length
      addSuccessToast(
        `Exported ${totalRows.toLocaleString()} data points (${metricsCount} metrics across ${stimuliCount} ${stimuliCount === 1 ? 'stimulus' : 'stimuli'})`
      )
    } finally {
      isExporting = false
    }
  }

  // Function to open main export options
  const handleOpenMainExport = () => {
    modalStore.open(ModalContentDownloadWorkplace as any, 'Export Options')
  }

  // Function to close modal
  const handleCancel = () => {
    modalStore.close()
  }

  // Button configuration (after handleExport declaration)
  const exportButtons = $derived([
    {
      label: isExporting ? 'Exporting...' : 'Export CSV',
      onclick: handleExport,
      isDisabled: !canExport || isExporting,
      variant: 'primary' as const,
    },
    {
      label: 'More Export Options',
      onclick: handleOpenMainExport,
      isDisabled: false,
    },
    {
      label: 'Cancel',
      onclick: handleCancel,
      isDisabled: false,
    },
  ])
</script>

<div class="container">
  <section class="section">
    <div class="content">
      <p class="purpose-description">
        Export statistical metrics (dwell time, fixation counts, durations) in
        long format for analysis in R, Python, or SPSS.
      </p>
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Export Settings" />
    <div class="content-two-column">
      <GeneralInputText
        label="File name"
        bind:value={fileName}
        placeholder="Enter filename without extension"
      />
      <GeneralSelect
        label="Participant Group"
        options={groupOptions}
        bind:value={selectedGroupId}
      />
    </div>
  </section>

  <section class="section">
    <div class="settings-grid">
      <div class="settings-column">
        <GeneralInputGroup
          title="Stimuli"
          items={stimuliItems}
          onItemChange={handleStimulusChange}
        />
        {#if selectedStimuliIds.size === 0}
          <p class="validation-message">
            Select at least one stimulus to export
          </p>
        {/if}
      </div>

      <div class="settings-column">
        <GeneralInputGroup
          title="Metrics"
          items={metricsItems}
          onItemChange={handleMetricChange}
        />
        {#if selectedMetrics.size === 0}
          <p class="validation-message">Select at least one metric to export</p>
        {/if}
      </div>
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Format Details" />
    <div class="content">
      <p class="format-description">
        <strong>Long format CSV</strong> with columns: Participant_ID,
        Participant_Name, Stimulus, AOI_Group, Metric, Value. Includes special
        AOI groups: <strong>No_AOI</strong> (fixations outside any AOI) and
        <strong>Any_Fixation</strong> (aggregated across all fixations).
      </p>
    </div>
  </section>

  <section class="section">
    <ModalButtons buttons={exportButtons} />
  </section>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .purpose-description {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .content-two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 500px) {
    .content-two-column {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 700px) {
    .settings-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }

  .settings-column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .validation-message {
    margin: 0;
    padding: 0.5rem;
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    color: #856404;
    font-size: 0.85rem;
  }

  .format-description {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }
</style>
