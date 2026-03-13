<script lang="ts">
  import GeneralInputText from '$lib/shared/components/GeneralInputText.svelte'
  import { ModalButtons } from '$lib/modals'
  import { getModalState } from '$lib/session'
  import { onDestroy } from 'svelte'

  const modalState = getModalState()

  /**
   * Trigger string to activate Web Stimulus parsing mode.
   */
  const WEB_STIMULUS_TRIGGER = 'WebStimulus'

  interface Props {
    valuePromiseResolve: (value: string) => void
    valuePromiseReject: (reason?: any) => void
  }

  let { valuePromiseResolve, valuePromiseReject }: Props = $props()
  let selectedOption: string = $state('')
  let customMarkers: string = $state('_start;_end')

  /**
   * Track whether the promise has been settled (resolved or rejected).
   * This prevents attempting to reject an already-resolved promise during cleanup.
   */
  let isPromiseSettled = false

  const resolveValue = (value: string) => {
    if (isPromiseSettled) return
    isPromiseSettled = true
    valuePromiseResolve(value)
  }

  const rejectValue = (reason: Error) => {
    if (isPromiseSettled) return
    isPromiseSettled = true
    valuePromiseReject(reason)
  }

  onDestroy(() => {
    rejectValue(new Error('Modal closed without value'))
  })

  /**
   * Handles form submission by resolving the promise with the selected value.
   * Marks the promise as settled to prevent double-handling during cleanup.
   */
  const handleSubmit = () => {
    const finalValue =
      selectedOption === 'custom' ? customMarkers : selectedOption
    resolveValue(finalValue)
  }

  /**
   * Handles cancellation by rejecting the promise and closing the modal.
   * Marks the promise as settled to prevent double-handling during cleanup.
   */
  const handleCancel = () => {
    rejectValue(new Error('User cancelled'))
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
        <div class="option-content">
          <h4 class="option-title">Interval Events</h4>
          <p class="option-subtitle">Glasses experiments</p>
        </div>
      </label>
    </div>

    <div
      class="option-card"
      class:selected={selectedOption === WEB_STIMULUS_TRIGGER}
      onclick={() => selectOption(WEB_STIMULUS_TRIGGER)}
      onkeydown={event => handleKeydown(event, WEB_STIMULUS_TRIGGER)}
      tabindex="0"
      role="button"
    >
      <label class="option-header">
        <input
          type="radio"
          bind:group={selectedOption}
          value={WEB_STIMULUS_TRIGGER}
        />
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
          <GeneralInputText
            bind:value={customMarkers}
            label="Markers (start;end)"
            placeholder="_start;_end"
          />
        </div>
      {/if}
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
</style>
