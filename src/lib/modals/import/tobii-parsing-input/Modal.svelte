<script lang="ts">
  import InputText from '$lib/shared/components/InputText.svelte'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import type { TobiiParsingConfig } from '$lib/data/ingest/formats/lib/rows/tobiiParsingConfig'
  import { serializeTobiiConfig } from '$lib/data/ingest/formats/lib/rows/tobiiParsingConfig'

  const { modalState } = getGazePlotterSession()

  let selectedOption: string = $state('')
  let customMarkers: string = $state('_start;_end')
  let eventStartSuffix: string = $state('')
  let eventEndSuffix: string = $state('')

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
    if (eventEndSuffix.trim()) {
      config.eventEndSuffix = eventEndSuffix
      if (eventStartSuffix.trim()) {
        config.eventStartSuffix = eventStartSuffix
      }
    }
    modalState.finish(serializeTobiiConfig(config))
  }

  /**
   * Handles cancellation by closing the modal.
   */
  const handleCancel = () => {
    modalState.close()
  }

  /**
   * Selects a radio option for stimulus parsing method.
   * @param option - The parsing option identifier
   */
  const selectOption = (option: string) => {
    selectedOption = option
  }

  /**
   * Prevents pointer/click events from bubbling to the parent card.
   * Ensures interactions inside the input do not change selected option.
   */
  const handleInputClick = (event: Event) => {
    event.stopPropagation()
  }

  /**
   * Handles keyboard navigation for option selection.
   * Allows Enter or Space to select an option.
   * @param event - The keyboard event
   * @param option - The option to select
   */
  const handleKeydown = (event: KeyboardEvent, option: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(option)
    }
  }
</script>

<div class="content">
  <p class="description">
    Choose how to determine stimuli from your Tobii Pro Lab data:
  </p>

  <div class="options">
    <div
      class="option-card"
      class:selected={selectedOption === ''}
      onclick={() => selectOption('')}
      onkeydown={event => handleKeydown(event, '')}
      tabindex="0"
      role="button"
    >
      <label class="option-header">
        <input type="radio" bind:group={selectedOption} value="" />
        <div class="option-content">
          <h4 class="option-title">Media Column</h4>
          <p class="option-subtitle">Screen-based experiments</p>
        </div>
      </label>
    </div>

    <div
      class="option-card"
      class:selected={selectedOption === 'interval'}
      onclick={() => selectOption('interval')}
      onkeydown={event => handleKeydown(event, 'interval')}
      tabindex="0"
      role="button"
    >
      <label class="option-header">
        <input type="radio" bind:group={selectedOption} value="interval" />
        <div class="option-content">
          <h4 class="option-title">Interval Events</h4>
          <p class="option-subtitle">Glasses experiments</p>
        </div>
      </label>
    </div>

    <div
      class="option-card"
      class:selected={selectedOption === 'web'}
      onclick={() => selectOption('web')}
      onkeydown={event => handleKeydown(event, 'web')}
      tabindex="0"
      role="button"
    >
      <label class="option-header">
        <input type="radio" bind:group={selectedOption} value="web" />
        <div class="option-content">
          <h4 class="option-title">Web Stimulus Events</h4>
          <p class="option-subtitle">Individual URLs as stimuli</p>
        </div>
      </label>
    </div>

    <div
      class="option-card"
      class:selected={selectedOption === 'custom'}
      onclick={() => selectOption('custom')}
      onkeydown={event => handleKeydown(event, 'custom')}
      tabindex="0"
      role="button"
    >
      <label class="option-header">
        <input type="radio" bind:group={selectedOption} value="custom" />
        <div class="option-content">
          <h4 class="option-title">Custom Markers</h4>
          <p class="option-subtitle">Define your own start/end events</p>
        </div>
      </label>
      {#if selectedOption === 'custom'}
        <div
          class="custom-input"
          onclick={handleInputClick}
          onpointerdown={handleInputClick}
          role="none"
        >
          <InputText
            bind:value={customMarkers}
            label="Markers (start;end)"
            placeholder="_start;_end"
          />
        </div>
      {/if}
    </div>
  </div>

  <div class="event-section">
    <h4 class="event-title">Duration events (optional)</h4>
    <p class="event-subtitle">
      Pair Event rows into duration events by name suffix — e.g. with end
      suffix "&nbsp;end", "Task1" / "Task1 end" become one "Task1" event.
      Other events are imported as instant events.
    </p>
    <div class="event-inputs">
      <InputText
        bind:value={eventStartSuffix}
        label="Start suffix (optional)"
        placeholder=" start"
      />
      <InputText
        bind:value={eventEndSuffix}
        label="End suffix"
        placeholder=" end"
      />
    </div>
  </div>
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

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .option-card {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .option-card:hover {
    border-color: var(--c-brand, #cd1404);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .option-card.selected {
    border-color: var(--c-brand, #cd1404);
    box-shadow: 0 0 0 2px rgba(205, 20, 4, 0.2);
    background: #fff;
  }

  .option-card:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .option-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    pointer-events: none;
    width: 100%;
  }

  .option-header input[type='radio'] {
    margin: 0;
    flex-shrink: 0;
    pointer-events: auto;
    accent-color: var(--c-brand, #cd1404);
  }

  .option-content {
    flex: 1;
  }

  .option-title {
    margin: 0 0 0.25rem 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--c-text);
    line-height: 1.3;
  }

  .option-subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: #666;
    line-height: 1.4;
  }

  .custom-input {
    margin-top: 0.75rem;
    cursor: auto;
  }

  .event-section {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid #ddd;
  }

  .event-title {
    margin: 0 0 0.25rem 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--c-text);
    line-height: 1.3;
  }

  .event-subtitle {
    margin: 0 0 0.75rem 0;
    font-size: 0.85rem;
    color: #666;
    line-height: 1.4;
  }

  .event-inputs {
    display: flex;
    gap: 0.75rem;
  }

  .event-inputs > :global(*) {
    flex: 1;
  }
</style>
