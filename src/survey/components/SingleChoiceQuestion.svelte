<script lang="ts">
  interface Props {
    /** Question title */
    title?: string;
    /** Question instructions */
    instructions?: string;
    /** Array of option labels */
    options: string[];
    /** Callback when an option is selected */
    onComplete?: (selectedOption: string) => void;
    /** Optional CSS class for custom styling */
    class?: string;
    /** Optional initial value to pre-populate selection */
    initialValue?: string | null;
    /** Callback when value changes (for parent state management) */
    onValueChange?: (value: string | null, isComplete: boolean) => void;
  }

  let {
    title = 'Please select an option',
    instructions = 'Choose the option that best applies',
    options,
    onComplete,
    class: className = '',
    initialValue = null,
    onValueChange
  }: Props = $props();

  // Selected option - initialize with provided value
  let selectedOption = $state<string | null>(initialValue);

  // Expose value and isComplete for parent component - update via effect
  let value = $state<string | null>(initialValue);
  let isComplete = $state(false);

  // Update exposed values when selectedOption changes
  $effect(() => {
    value = selectedOption;
    isComplete = selectedOption !== null;

    if (onValueChange) {
      onValueChange(selectedOption, selectedOption !== null);
    }

    if (onComplete && selectedOption) {
      onComplete(selectedOption);
    }
  });

  // Animation state
  let animatingOption = $state<string | null>(null);

  const handleOptionSelect = (option: string): void => {
    animatingOption = option;
    selectedOption = option;
    
    setTimeout(() => {
      animatingOption = null;
    }, 300);
  };

  const getColor = (option: string): string => {
    if (option === selectedOption) {
      return 'var(--c-success)';
    }
    return 'var(--c-midgrey)';
  };

  const getBackgroundColor = (option: string): string => {
    if (option === selectedOption) {
      return 'rgba(34, 197, 94, 0.1)';
    }
    return 'var(--c-white)';
  };
</script>

<div class="single-choice-question" class:className>
  <div class="question-header">
    <h2>{title}</h2>
    <p class="instructions">{instructions}</p>
  </div>

  <div class="options-container">
    {#each options as option, index (option)}
      {@const isSelected = selectedOption === option}
      {@const isAnimating = animatingOption === option}
      
      <button
        class="option-button"
        class:selected={isSelected}
        class:animating={isAnimating}
        style="
          animation-delay: {index * 50}ms;
          --color: {getColor(option)};
          --background-color: {getBackgroundColor(option)};
        "
        onclick={() => handleOptionSelect(option)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOptionSelect(option);
          }
        }}
        tabindex="0"
        role="radio"
        aria-checked={isSelected}
        aria-label="Option: {option}"
      >
        <span class="option-text">{option}</span>
        {#if isSelected}
          <div class="selection-indicator"></div>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .single-choice-question {
    width: 100%;
    margin: 0 auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-sizing: border-box;
  }

  .question-header {
    text-align: center;
    margin-bottom: 1rem;
  }

  .question-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--c-black);
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
  }

  .instructions {
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }

  .options-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .option-button {
    position: relative;
    width: 100%;
    padding: 1rem 1.25rem;
    background: var(--background-color);
    border: 2px solid var(--c-lightgrey);
    border-radius: var(--rounded-md);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--c-black);
    outline: none;
    user-select: none;
    opacity: 0;
    transform: translateX(-20px);
    animation: slideIn 0.5s ease forwards;
  }

  .option-button:hover {
    transform: translateX(5px);
    border-color: var(--c-midgrey);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .option-button:focus {
    outline: 2px solid var(--c-midgrey);
    outline-offset: 2px;
  }

  .option-button.selected {
    border-color: var(--color);
    background: var(--background-color);
    color: var(--color);
    transform: translateX(5px);
    box-shadow: 0 6px 20px rgba(34, 197, 94, 0.2);
    font-weight: 600;
  }

  .option-button.animating {
    transform: scale(1.02) translateX(5px);
    box-shadow: 0 8px 24px rgba(34, 197, 94, 0.25);
  }

  @keyframes slideIn {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .option-text {
    position: relative;
    z-index: 2;
  }

  .selection-indicator {
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    background: var(--color);
    border-radius: 50%;
    border: 2px solid white;
    animation: pulse 0.6s ease;
  }

  @keyframes pulse {
    0% { transform: translateY(-50%) scale(0); opacity: 0; }
    50% { transform: translateY(-50%) scale(1.2); opacity: 1; }
    100% { transform: translateY(-50%) scale(1); opacity: 1; }
  }

  @media (max-width: 640px) {
    .single-choice-question {
      padding: 0.75rem 0.5rem;
      gap: 1rem;
    }

    .option-button {
      padding: 0.875rem 1rem;
      font-size: 0.9rem;
    }

    .question-header h2 {
      font-size: 1.1rem;
    }

    .instructions {
      font-size: 0.85rem;
    }
  }
</style>

