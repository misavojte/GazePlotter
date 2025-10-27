<script lang="ts">
  import type { UEQSResults } from '$survey/types/index';

  /**
   * UEQS (User Experience Questionnaire Short) Survey Component
   */

  interface Props {
    /** Callback when survey is completed */
    onComplete?: (results: UEQSResults) => void;
    /** Optional CSS class for custom styling */
    class?: string;
    /** Optional initial values to pre-populate the survey */
    initialValues?: UEQSResults | null;
    /** Callback when completion status changes */
    onCompletionChange?: (isComplete: boolean, results: UEQSResults | null) => void;
    /** Callback when survey value changes (for parent state management) */
    onValueChange?: (results: UEQSResults | null, isComplete: boolean) => void;
  }

  let { onComplete, class: className = '', initialValues = null, onCompletionChange, onValueChange }: Props = $props();

  // UEQS scale items with their bipolar adjectives
  const scaleItems = [
    { id: 'usual-leading', left: 'usual', right: 'leading-edge' },
    { id: 'boring-exciting', left: 'boring', right: 'exciting' },
    { id: 'complicated-easy', left: 'complicated', right: 'easy' },
    { id: 'confusing-clear', left: 'confusing', right: 'clear' },
    { id: 'obstructive-supportive', left: 'obstructive', right: 'supportive' },
    { id: 'not-interesting-interesting', left: 'not interesting', right: 'interesting' },
    { id: 'conventional-inventive', left: 'conventional', right: 'inventive' },
    { id: 'inefficient-efficient', left: 'inefficient', right: 'efficient' }
  ] as const;

  // Scale values from -3 to +3
  const scaleValues = [-3, -2, -1, 0, 1, 2, 3] as const;
  type ScaleValue = typeof scaleValues[number];

  // Results state - initialize with provided values
  // Ensure all scale items have entries (null if not in initialValues)
  let results = $state<Record<string, ScaleValue | null>>(
    initialValues 
      ? Object.fromEntries(scaleItems.map(item => [
          item.id, 
          (initialValues[item.id as keyof typeof initialValues] as ScaleValue | undefined) ?? null
        ]))
      : {}
  );

  // Animation state
  let animatingItem = $state<string | null>(null);

  // Expose value and isComplete for parent component - update via effect
  let value = $state<UEQSResults | null>(null);
  let isComplete = $state(false);

  // Update exposed values when results change
  $effect(() => {
    const allCompleted = scaleItems.every(item => results[item.id] !== null && results[item.id] !== undefined);
    const resultsData = results as unknown as UEQSResults;

    isComplete = allCompleted;
    // Always expose the current results, even when incomplete, to preserve partial progress
    value = resultsData;

    if (onCompletionChange) {
      onCompletionChange(allCompleted, resultsData);
    }

    if (onValueChange) {
      // Always pass current results, even when incomplete, so parent can save partial progress
      onValueChange(resultsData, allCompleted);
    }

    if (onComplete && allCompleted) {
      onComplete(resultsData);
    }
  });

  /**
   * Handle scale selection with smooth animation
   */
  const handleScaleSelect = (itemId: string, value: ScaleValue) => {
    // Set animating state for smooth transition
    animatingItem = itemId;
    
    // Update results
    results[itemId] = value;
    
    // Clear animation state after transition
    setTimeout(() => {
      animatingItem = null;
    }, 300);
  };

  /**
   * Get the visual intensity for a scale value
   */
  const getIntensity = (value: ScaleValue) => {
    return Math.abs(value) / 3;
  };

  /**
   * Get the color for a scale value
   */
  const getColor = (value: ScaleValue) => {
    if (value === 0) return 'var(--c-midgrey)';
    if (value > 0) return 'var(--c-success)';
    return 'var(--c-error)';
  };

  /**
   * Get the background color for a scale value
   */
  const getBackgroundColor = (value: ScaleValue) => {
    if (value === 0) return 'var(--c-lightgrey)';
    if (value > 0) return 'rgba(34, 197, 94, 0.1)';
    return 'rgba(255, 77, 79, 0.1)';
  };
</script>

<!-- UEQS Survey Component -->
<div class="ueqs-survey" class:className>
  <!-- Header -->
  <div class="survey-header">
    <h2>How would you rate your experience with GazePlotter?</h2>
    <p class="instructions">
      Please indicate your impression by selecting the position on each scale that best reflects your experience.
      <br>
      <span class="scale-info">−3 = strongly left-hand word, +3 = strongly right-hand word</span>
    </p>
  </div>


  <!-- Scale Items -->
  <div class="scale-items">
    {#each scaleItems as item, index (item.id)}
      {@const currentValue = results[item.id] ?? null}
      {@const isAnimating = animatingItem === item.id}
      
      <div 
        class="scale-item" 
        class:completed={currentValue !== null}
        class:animating={isAnimating}
        style="animation-delay: {index * 50}ms"
      >
        <!-- Scale Labels -->
        <div class="scale-labels">
          <span class="label-left">{item.left}</span>
          <span class="label-right">{item.right}</span>
        </div>

        <!-- Scale Slider -->
        <div class="scale-slider">
          {#each scaleValues as value}
            {@const isSelected = currentValue === value}
            {@const intensity = getIntensity(value)}
            {@const color = getColor(value)}
            {@const backgroundColor = getBackgroundColor(value)}
            
            <button
              class="scale-button"
              class:selected={isSelected}
              class:positive={value > 0}
              class:negative={value < 0}
              class:neutral={value === 0}
              style="
                --intensity: {intensity};
                --color: {color};
                --background-color: {backgroundColor};
              "
              onclick={() => handleScaleSelect(item.id, value)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleScaleSelect(item.id, value);
                }
              }}
              tabindex="0"
              role="radio"
              aria-checked={isSelected}
              aria-label="Rate {item.left} to {item.right} as {value}"
            >
              <span class="scale-value">{value}</span>
              {#if isSelected}
                <div class="selection-indicator"></div>
              {/if}
            </button>
          {/each}
        </div>

      </div>
    {/each}
  </div>

</div>

<style>
  .ueqs-survey {
    width: 100%;
    margin: 0 auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-sizing: border-box;
  }

  .survey-header {
    text-align: center;
    margin-bottom: 1rem;
  }

  .survey-header h2 {
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

  .scale-info {
    font-weight: 500;
    color: var(--c-black);
  }


  .scale-items {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .scale-item {
    padding: 1rem;
    background: var(--c-white);
    border: 2px solid var(--c-lightgrey);
    border-radius: var(--rounded-md);
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateY(20px);
    animation: slideIn 0.6s ease forwards;
  }

  .scale-item.completed {
    border-color: var(--c-success);
    background: var(--c-darkwhite);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  .scale-item.animating {
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(205, 20, 4, 0.15);
  }

  @keyframes slideIn {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .scale-labels {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-weight: 500;
    color: var(--c-black);
    font-size: 0.85rem;
  }

  .label-left {
    color: var(--c-error);
  }

  .label-right {
    color: var(--c-success);
  }

  .scale-slider {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .scale-button {
    position: relative;
    width: 40px;
    height: 40px;
    border: 2px solid var(--c-lightgrey);
    border-radius: 50%;
    background: var(--c-white);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    font-size: 0.8rem;
    color: var(--c-darkgrey);
    outline: none;
    user-select: none;
  }

  .scale-button:hover {
    transform: scale(1.1);
    border-color: var(--c-midgrey);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .scale-button:focus {
    outline: 2px solid var(--c-midgrey);
    outline-offset: 2px;
  }

  .scale-button.selected {
    border-color: var(--color);
    background: var(--background-color);
    color: var(--color);
    transform: scale(1.15);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }

  .scale-button.positive.selected {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1));
  }

  .scale-button.negative.selected {
    background: linear-gradient(135deg, rgba(255, 77, 79, 0.2), rgba(255, 77, 79, 0.1));
  }

  .scale-button.neutral.selected {
    background: var(--c-lightgrey);
    border-color: var(--c-darkgrey);
    border-width: 3px;
  }

  .scale-value {
    position: relative;
    z-index: 2;
  }

  .selection-indicator {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 16px;
    height: 16px;
    background: var(--color);
    border-radius: 50%;
    border: 2px solid white;
    animation: pulse 0.6s ease;
  }

  @keyframes pulse {
    0% { transform: scale(0); opacity: 0; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }



  /* Responsive design */
  @media (max-width: 640px) {
    .ueqs-survey {
      padding: 0.75rem 0.5rem;
      gap: 1rem;
    }

    .scale-item {
      padding: 0.75rem;
    }

    .scale-slider {
      gap: 0.25rem;
    }

    .scale-button {
      width: 36px;
      height: 36px;
      font-size: 0.75rem;
    }

    .survey-header h2 {
      font-size: 1.1rem;
    }

    .instructions {
      font-size: 0.85rem;
    }
  }
</style>
