<script lang="ts">
  import { modalStore } from '$lib/modals/shared/stores/modalStore';
  import { UEQSSurvey, OpenEndedFeedback, SingleChoiceQuestion } from '$survey/components';
  import { EyeTrackingExperience as ETExperience } from '$survey/types';
  import type { UEQSResults, EyeTrackingExperienceResult, SurveyModalState } from '$survey/types';

  interface Props {
    /** Survey state object - managed by parent to persist across modal closes */
    surveyState: SurveyModalState;
    /** Callback when survey is completed */
    onComplete?: (results: { ueqs: UEQSResults; eyeTracking: EyeTrackingExperienceResult; feedback: string }) => void;
  }

  let { surveyState, onComplete }: Props = $props();
  
  // Navigation state
  const steps = ['ueqs', 'eye-tracking', 'feedback'] as const;
  let currentStep = $derived(steps[surveyState.currentStepIndex]);
  
  // Track when Next button should be enabled (400ms delay after selection)
  let nextButtonEnabled = $state(false);
  let selectionTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Derived state for button enabled status with 400ms delay after completion
  let canProceed = $derived.by(() => {
    if (!isCurrentStepComplete) return false;
    return nextButtonEnabled;
  });

  /**
   * Check if current step is completed
   */
  const isCurrentStepComplete = $derived.by(() => {
    if (surveyState.isCompleted) return true;

    let complete = false;
    switch (currentStep) {
      case 'ueqs':
        complete = surveyState.ueqsComplete;
        console.log('UEQS complete check:', { isComplete: surveyState.ueqsComplete });
        break;
      case 'eye-tracking':
        complete = surveyState.eyeTrackingValue !== null;
        break;
      case 'feedback':
        complete = surveyState.feedbackValue.trim() !== '';
        break;
      default:
        complete = false;
    }
    return complete;
  });

  /**
   * Save current step data
   */
  const saveCurrentStepData = () => {
    switch (currentStep) {
      case 'ueqs':
        // UEQS results are saved when the component emits the completion event
        break;
      case 'eye-tracking':
        if (surveyState.eyeTrackingValue) {
          surveyState.eyeTrackingResults = { experience: surveyState.eyeTrackingValue as ETExperience };
        }
        break;
      case 'feedback':
        surveyState.feedbackText = surveyState.feedbackValue;
        break;
    }
  };

  /**
   * Navigate to next step
   */
  const goToNextStep = () => {
    if (!isCurrentStepComplete) return;
    
    saveCurrentStepData();
    
    if (surveyState.currentStepIndex === steps.length - 1) {
      // Complete survey
      surveyState.isCompleted = true;
      
      if (onComplete && surveyState.ueqsResults && surveyState.eyeTrackingResults) {
        onComplete({
          ueqs: surveyState.ueqsResults,
          eyeTracking: surveyState.eyeTrackingResults,
          feedback: surveyState.feedbackText
        });
      }
    } else {
      surveyState.currentStepIndex++;
      nextButtonEnabled = false;
    }
  };

  /**
   * Navigate to previous step
   */
  const goToPreviousStep = () => {
    if (surveyState.currentStepIndex > 0) {
      saveCurrentStepData();
      surveyState.currentStepIndex--;
      nextButtonEnabled = false;
    }
  };

  /**
   * Initialize next button state when step changes or completion status changes
   */
  $effect(() => {
    // Watch for changes in surveyState.currentStepIndex
    surveyState.currentStepIndex;
    
    // Clear any existing timer
    if (selectionTimer) {
      clearTimeout(selectionTimer);
      selectionTimer = null;
    }
    
    // Reset button state
    nextButtonEnabled = false;
    
    // Enable button immediately if step is complete
    if (isCurrentStepComplete) {
      nextButtonEnabled = true;
    }
    
    return () => {
      if (selectionTimer) {
        clearTimeout(selectionTimer);
      }
    };
  });

  const handleGoToGazePlotter = () => {
    modalStore.close();
  };
</script>

<div class="survey-modal">
  <!-- Progress Dots -->
  {#if !surveyState.isCompleted}
    <div class="progress-dots">
      {#each Array(steps.length) as _, index}
        <div class="dot" class:active={index === surveyState.currentStepIndex}></div>
      {/each}
    </div>
  {/if}
  
  <div class="survey-content">
    {#if !surveyState.isCompleted}
      <div class="slide-wrapper">
        <div class="slide">
          <!-- Always render all components so they maintain state -->
          <div class:hidden={currentStep !== 'ueqs'}>
            <UEQSSurvey
              initialValues={surveyState.ueqsResults}
              onComplete={(results) => {
                surveyState.ueqsResults = results;
                surveyState.ueqsComplete = true;
              }}
              onCompletionChange={(complete, results) => {
                surveyState.ueqsComplete = complete;
                // Always save results to preserve partial progress
                if (results) {
                  surveyState.ueqsResults = results;
                }
              }}
              onValueChange={(results, complete) => {
                surveyState.ueqsComplete = complete;
                // Always save results, even when incomplete, to preserve partial progress
                if (results) {
                  surveyState.ueqsResults = results;
                }
              }}
            />
          </div>

          <div class:hidden={currentStep !== 'eye-tracking'}>
            <SingleChoiceQuestion
              instructions="How long have you worked with eye-tracking?"
              options={[
                ETExperience.LESS_THAN_6_MONTHS,
                ETExperience.SIX_TO_TWELVE_MONTHS,
                ETExperience.ONE_TO_TWO_YEARS,
                ETExperience.THREE_TO_FIVE_YEARS,
                ETExperience.MORE_THAN_5_YEARS
              ]}
              initialValue={surveyState.eyeTrackingResults?.experience}
              onComplete={(value) => {
                surveyState.eyeTrackingValue = value;
              }}
              onValueChange={(value, complete) => {
                surveyState.eyeTrackingValue = value;
              }}
            />
          </div>

          <div class:hidden={currentStep !== 'feedback'}>
            <OpenEndedFeedback
              instructions="(i) One thing you liked, (ii) one thing you disliked, and (iii) any other comment. Write as much or as little as you wish."
              placeholder="Share your thoughts here..."
              initialValue={surveyState.feedbackText}
              onComplete={(value) => {
                surveyState.feedbackValue = value;
              }}
              onValueChange={(value, complete) => {
                surveyState.feedbackValue = value;
              }}
            />
          </div>
        </div>
        
        <!-- Navigation Buttons -->
        <div class="navigation-buttons">
          {#if surveyState.currentStepIndex > 0}
            <button
              class="nav-button prev"
              onclick={goToPreviousStep}
            >
              ← Previous
            </button>
          {:else}
            <div class="nav-button-placeholder"></div>
          {/if}
          <button
            class="nav-button next"
            onclick={goToNextStep}
            disabled={!isCurrentStepComplete || !nextButtonEnabled}
          >
            {#if surveyState.currentStepIndex === steps.length - 1}
              Submit
            {:else}
              Next →
            {/if}
          </button>
        </div>
      </div>
    {:else}
      <!-- Completion Screen -->
      <div class="completion-slide">
        <div class="completion-message">
          <div class="completion-content">
            <h3>🎉 Thank you for your feedback!</h3>
            <p>Your responses have been recorded and will help us improve GazePlotter for researchers and practitioners.</p>
            <button class="continue-button" onclick={handleGoToGazePlotter}>
              Go to GazePlotter
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .survey-modal {
    max-width: 700px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .progress-dots {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding: 0.5rem 0;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c-lightgrey);
    transition: all 0.3s ease;
  }

  .dot.active {
    background: var(--c-success);
    transform: scale(1.2);
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
  }

  .survey-content {
    position: relative;
    min-height: 400px;
    width: 100%;
  }

  .slide-wrapper {
    width: 100%;
    box-sizing: border-box;
    animation: slideIn 0.4s ease-out;
  }

  .slide {
    width: 100%;
    box-sizing: border-box;
  }

  .hidden {
    display: none;
  }

  .nav-button-placeholder {
    width: 120px; /* Same width as nav-button min-width */
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Navigation Buttons */
  .navigation-buttons {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--c-lightgrey);
  }

  .nav-button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--rounded);
    font-weight: 500;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 120px;
  }

  .nav-button.prev {
    background: var(--c-white);
    color: var(--c-black);
    border: 2px solid var(--c-lightgrey);
  }

  .nav-button.prev:hover:not(:disabled) {
    background: var(--c-darkwhite);
    border-color: var(--c-midgrey);
  }

  .nav-button.next {
    background: var(--c-success);
    color: white;
  }

  .nav-button.next:hover:not(:disabled) {
    background: #16a34a;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  }

  .nav-button:disabled {
    background: var(--c-lightgrey);
    color: var(--c-midgrey);
    cursor: not-allowed;
    transform: none;
    border-color: transparent;
  }

  .nav-button.prev:disabled {
    background: var(--c-white);
    border-color: var(--c-lightgrey);
    color: var(--c-midgrey);
  }

  /* Completion Screen */
  .completion-slide {
    animation: fadeIn 0.5s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .completion-message {
    text-align: center;
    padding: 2rem;
    background: linear-gradient(135deg, var(--c-success), #16a34a);
    color: white;
    border-radius: var(--rounded-md);
    box-shadow: 0 8px 32px rgba(34, 197, 94, 0.3);
  }

  .completion-content h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .completion-content p {
    margin: 0 0 1.5rem 0;
    opacity: 0.9;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .continue-button {
    background: white;
    color: var(--c-success);
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: var(--rounded);
    font-weight: 500;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .continue-button:hover {
    background: var(--c-darkwhite);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .continue-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .survey-modal {
      padding: 1rem;
      margin: 0.5rem;
    }

    .completion-message {
      padding: 1.5rem;
    }

    .completion-content h3 {
      font-size: 1.1rem;
    }

    .completion-content p {
      font-size: 0.85rem;
    }

    .continue-button {
      padding: 0.65rem 1.25rem;
      font-size: 0.85rem;
    }

    .nav-button {
      padding: 0.65rem 1.25rem;
      font-size: 0.85rem;
      min-width: 100px;
    }
  }
</style>
