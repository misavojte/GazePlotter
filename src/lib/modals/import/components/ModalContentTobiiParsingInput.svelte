<script lang="ts">
  import GeneralInputText from '$lib/shared/components/GeneralInputText.svelte'
  import { ModalButtons } from '$lib/modals'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { onDestroy } from 'svelte'

  interface Props {
    valuePromiseResolve: (value: string) => void
    valuePromiseReject: (reason?: any) => void
  }

  let { valuePromiseResolve, valuePromiseReject }: Props = $props()
  let selectedOption: string = $state('')
  let customMarkers: string = $state('_start;_end')

  onDestroy(() => {
    valuePromiseReject(new Error('Modal closed without value'))
  })

  const handleSubmit = () => {
    const finalValue =
      selectedOption === 'custom' ? customMarkers : selectedOption
    console.log('value', finalValue)
    valuePromiseResolve(finalValue)
  }

  const handleCancel = () => {
    valuePromiseReject(new Error('User cancelled'))
    modalStore.close()
  }

  const selectOption = (option: string) => {
    selectedOption = option
  }

  const handleInputClick = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const handleKeydown = (event: KeyboardEvent, option: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(option)
    }
  }
</script>

<div class="content">
  <p class="description">
    GazePlotter detected Tobii Pro Lab data with an Event column. Choose how the
    stimulus should be determined:
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
        <div class="option-title">Media Record Column for stimuli</div>
      </label>
      <div class="option-description">
        Uses the standard media/stimulus column. Best for <strong
          >screen-based eye tracker experiments</strong
        >
        where stimuli are pre-defined in the recording setup.
      </div>
    </div>

    <div
      class="option-card"
      class:selected={selectedOption === ' IntervalStart; IntervalEnd'}
      onclick={() => selectOption(' IntervalStart; IntervalEnd')}
      onkeydown={event => handleKeydown(event, ' IntervalStart; IntervalEnd')}
      tabindex="0"
      role="button"
    >
      <label class="option-header">
        <input
          type="radio"
          bind:group={selectedOption}
          value=" IntervalStart; IntervalEnd"
        />
        <div class="option-title">Interval Events Markers for stimuli</div>
      </label>
      <div class="option-description">
        Uses '<em>%STIMULUS% IntervalStart</em>' and '<em
          >%STIMULUS% IntervalEnd</em
        >' events for stimuli detection. Ideal for
        <strong>mobile eye tracker experiments</strong> where stimuli timing is event-driven.
      </div>
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
        <div class="option-title">Custom Event Markers for stimuli</div>
      </label>
      <div class="option-description">
        <p>Define your own start and end markers using the format below:</p>
        <div
          class="custom-input-inline"
          onclick={handleInputClick}
          role="presentation"
        >
          <GeneralInputText
            bind:value={customMarkers}
            label="Custom markers (start;end)"
            placeholder="_start;_end"
          />
        </div>
        <p class="example-text">
          For example: <code>_start;_end</code> will match '<em
            >stimulus_start</em
          >' and '<em>stimulus_end</em>' events.
        </p>
      </div>
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
    margin-bottom: 1.5rem;
    color: var(--c-darkgrey);
    line-height: 1.5;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .option-card {
    padding: 1.25rem;
    border: 1px solid var(--c-lightgrey);
    border-radius: var(--rounded-md);
    background: var(--c-white);
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .option-card:hover {
    background: var(--c-darkwhite);
  }

  .option-card.selected {
    border-color: var(--c-brand);
    box-shadow: 0 0 0 1px var(--c-brand);
    background: var(--c-darkwhite);
  }

  .option-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    pointer-events: none;
  }

  .option-header input[type='radio'] {
    margin: 0;
    flex-shrink: 0;
    pointer-events: auto;
    accent-color: var(--c-brand);
  }

  .option-title {
    font-weight: 600;
    color: var(--c-black);
    font-size: 1rem;
  }

  .option-description {
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    line-height: 1.5;
    margin-left: 2rem;
  }

  .option-description p {
    margin: 0 0 0.75rem 0;
  }

  .option-description p:last-child {
    margin-bottom: 0;
  }

  .option-description strong {
    color: var(--c-black);
  }

  .option-description em {
    background: var(--c-lightgrey);
    padding: 0.125rem 0.25rem;
    border-radius: var(--rounded);
    font-style: normal;
    font-family: monospace;
    font-size: 0.85em;
  }

  .option-description code {
    background: var(--c-lightgrey);
    padding: 0.125rem 0.25rem;
    border-radius: var(--rounded);
    font-family: monospace;
    font-size: 0.85em;
  }

  .custom-input-inline {
    margin: 0.75rem 0;
    cursor: auto;
  }

  .example-text {
    font-size: 0.85rem;
    color: var(--c-darkgrey);
  }
</style>
