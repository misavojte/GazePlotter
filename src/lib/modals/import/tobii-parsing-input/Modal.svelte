<script lang="ts">
  import InputText from '$lib/shared/components/InputText.svelte'
  import Radio from '$lib/shared/components/Radio.svelte'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import type { TobiiParsingConfig } from '$lib/data/ingest/formats/lib/rows/tobiiParsingConfig'
  import { serializeTobiiConfig } from '$lib/data/ingest/formats/lib/rows/tobiiParsingConfig'

  const { modalState } = getGazePlotterSession()

  const STIMULUS_OPTIONS = [
    { value: '', label: 'Media Column — screen-based experiments' },
    { value: 'interval', label: 'Interval Events — glasses experiments' },
    { value: 'web', label: 'Web Stimulus Events — individual URLs as stimuli' },
    { value: 'custom', label: 'Custom Markers — your own start/end events' },
  ]

  let selectedOption: string = $state('')
  let customMarkers: string = $state('_start;_end')

  /**
   * Handles form submission by resolving the promise with the serialized
   * keyed config (see tobiiParsingConfig.ts — keys present iff active).
   */
  const handleSubmit = () => {
    const config: TobiiParsingConfig = {}
    if (selectedOption === 'interval') {
      config.stimulusStartSuffix = 'IntervalStart'
      config.stimulusEndSuffix = 'IntervalEnd'
    } else if (selectedOption === 'web') {
      config.stimulusWeb = true
    } else if (selectedOption === 'custom') {
      const [start, end] = customMarkers.split(';').map(p => p.trim())
      config.stimulusStartSuffix = start
      config.stimulusEndSuffix = end
    }
    modalState.finish(serializeTobiiConfig(config))
  }

  const handleCancel = () => {
    modalState.close()
  }
</script>

<div class="content">
  <p class="description">
    Choose how to determine stimuli from your Tobii Pro Lab data:
  </p>

  <Radio
    ariaLabel="Stimulus parsing method"
    options={STIMULUS_OPTIONS}
    bind:value={selectedOption}
  />

  {#if selectedOption === 'custom'}
    <div class="custom-input">
      <InputText
        bind:value={customMarkers}
        label="Markers (start;end)"
        placeholder="_start;_end"
      />
    </div>
  {/if}
</div>

<ModalButtons
  buttons={[
    {
      label: 'Apply',
      onclick: handleSubmit,
      variant: 'primary',
    },
    {
      label: 'Cancel',
      onclick: handleCancel,
    },
  ]}
/>

<style>
  .content {
    margin-bottom: 2rem;
  }

  .description {
    margin-bottom: 1rem;
    color: var(--c-text);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .custom-input {
    margin-top: 0.75rem;
  }
</style>
