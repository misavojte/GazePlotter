<script lang="ts">
  import { modalStore } from '$lib/modals/shared/stores/modalStore';
  import { UEQSSurvey } from '$survey/components';
  import type { UEQSResults } from '$survey/types';

  interface Props {
    /** Callback when survey is completed */
    onComplete?: (results: UEQSResults) => void;
  }

  let { onComplete }: Props = $props();
  let isCompleted = $state(false);
  let surveyResults: UEQSResults | null = $state(null);

  const handleSurveyComplete = (results: UEQSResults) => {
    console.log('UEQS Survey completed:', results);
    
    surveyResults = results;
    isCompleted = true;
    
    if (onComplete) {
      onComplete(results);
    }
  };

  const handleGoToGazePlotter = () => {
    modalStore.close();
  };
</script>

<div class="survey-modal">
  <div class="modal-header">
    <h2>User Experience Questionnaire</h2>
    <p class="modal-description">
      Please take a moment to rate your experience with GazePlotter. 
      Your feedback helps us improve the tool for researchers and practitioners.
    </p>
  </div>
  
  <div class="survey-content">
    {#if !isCompleted}
      <UEQSSurvey onComplete={handleSurveyComplete} />
    {:else}
      <div class="completion-message">
        <div class="completion-content">
          <h3>🎉 Thank you for your feedback!</h3>
          <p>Your responses have been recorded and will help us improve GazePlotter for researchers and practitioners.</p>
          <button class="continue-button" onclick={handleGoToGazePlotter}>
            Go to GazePlotter
          </button>
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

  .modal-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--c-lightgrey);
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--c-black);
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
  }

  .modal-description {
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
    max-width: 500px;
    margin: 0 auto;
  }

  .survey-content {
    position: relative;
  }

  .completion-message {
    text-align: center;
    padding: 2rem;
    background: linear-gradient(135deg, var(--c-success), #16a34a);
    color: white;
    border-radius: var(--rounded-md);
    margin-top: 1rem;
    animation: completionReveal 0.8s ease;
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

  @keyframes completionReveal {
    0% {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .survey-modal {
      padding: 1rem;
      margin: 0.5rem;
    }

    .modal-header {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
    }

    .modal-header h2 {
      font-size: 1.1rem;
    }

    .modal-description {
      font-size: 0.85rem;
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
  }
</style>
