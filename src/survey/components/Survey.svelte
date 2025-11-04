<script lang="ts">
  import { surveyStore } from '$survey/stores/surveyStore';
  import type { SurveyTask } from '$survey/types/index';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { endpointService } from '$survey/services/endpointService';

  /**
   * Props for the Survey component
   */
  interface Props {
    /** Array of survey tasks (required for SSR) */
    tasks: SurveyTask[];
    /** Optional CSS class for custom styling */
    class?: string;
    forceCloseBanner?: boolean;
  }

  let { tasks, class: className = '', forceCloseBanner = false }: Props = $props();
  
  // Get session ID and withdrawal email
  const sessionId = endpointService.getSessionId();
  const consentWithdrawEmail = 'mail@vojtechovska.com';

  // --- Store Initialization ---
  $effect(() => {
    if (tasks.length > 0) {
      try {
        surveyStore.setTasks(tasks);
      } catch (error) {
        // Tasks already initialized, which is fine for SSR
      }
    }
  });

  $effect(() => {
    if (forceCloseBanner && showBanner) {
      hideBanner();
    }
  });

  // --- Store Subscriptions ---
  const surveyState = $derived($surveyStore);
  const currentTaskIndex = $derived(surveyState.currentActiveTaskIndex);
  const currentTask = $derived(surveyState.tasks[currentTaskIndex]);
  const isCompleted = $derived(surveyState.isCompleted);
  
  // Determine if current task is skippable (default to true if not specified)
  const isCurrentTaskSkippable = $derived(
    currentTask ? (currentTask.skippable !== false) : false
  );

  // --- State for Banner Visibility ---
  let showBanner = $state(false);
  let bannerHiding = $state(false);
  let activeTaskElements: (HTMLElement | null)[] = $state([]);
  
  // --- State for Task Skipping ---
  let skipReason = $state('');
  const SKIP_REASON_LIMIT = 500;
  const remainingChars = $derived(SKIP_REASON_LIMIT - skipReason.length);
  const canSkip = $derived(skipReason.trim().length > 0);
  

  // --- Scroll Handler for Banner ---
  function handleScroll() {
    if (forceCloseBanner) {
      return;
    }
    if (isCompleted) {
      if (showBanner && !bannerHiding) {
        hideBanner();
      }
      return;
    }

    const activeTaskElement = activeTaskElements[currentTaskIndex];
    if (!activeTaskElement) return;

    const rect = activeTaskElement.getBoundingClientRect();
    const taskIsAboveViewport = rect.bottom < 100; // this is intentional:)
    
    if (taskIsAboveViewport && !showBanner && !bannerHiding) {
      showBanner = true;
      bannerHiding = false;
    } else if (!taskIsAboveViewport && showBanner && !bannerHiding) {
      hideBanner();
    }
  }

  // Hide banner with animation
  function hideBanner() {
    if (bannerHiding) return;
    
    bannerHiding = true;
    setTimeout(() => {
      showBanner = false;
      bannerHiding = false;
    }, 300); // Match animation duration
  }

  // Setup scroll listener
  onMount(() => {
    if (!browser) return;
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });


  // --- Automatic Task Progression ---
  $effect(() => {
    if (!browser || isCompleted || !currentTask?.condition) return;

    const unsubscribe = currentTask.condition.subscribe((conditionMet) => {
      if (conditionMet) {
        surveyStore.nextTask();
      }
    });

    return unsubscribe;
  });

  /**
   * Handles the skip task button click
   * Attempts to skip the current task if it is marked as skippable
   * Calls the onSkip callback with the task index and reason if provided
   */
  function handleSkipTask(): void {
    if (!canSkip || !currentTask) return;
    
    // Call the task's onSkip callback if provided
    if (currentTask.onSkip) {
      currentTask.onSkip(currentTaskIndex, skipReason.trim());
    }
    
    // Clear the skip reason for the next task
    skipReason = '';
    
    // Skip the task in the store
    surveyStore.skipTask();
  }
</script>

{#if showBanner && !isCompleted && currentTask}
  <!-- class scroll-banner is used to detect the banner height in workspace toolbar-->
  <div class="banner scroll-banner" class:hiding={bannerHiding}>
    <div class="banner-content-wrapper">
      {#key currentTaskIndex}
        <div 
          class="banner-content"
          in:fly={{ y: -20, duration: 300, delay: 50 }}
          out:fly={{ y: 20, duration: 250, opacity: 0 }}
        >
          <div class="banner-task-label">
            TASK {currentTaskIndex + 1} OF {tasks.length}
          </div>
          <div class="banner-text-row">
            <div class="banner-text">
              {currentTask.text}
            </div>
            
            {#if currentTask.buttonText && currentTask.onButtonClick}
              <button 
                class="banner-button"
                onclick={currentTask.onButtonClick}
              >
                {currentTask.buttonText}
              </button>
            {/if}
          </div>
        </div>
      {/key}
    </div>
  </div>
{/if}

<div class="survey" class:className>
  {#if tasks.length === 0}
    <div class="empty">No survey tasks available</div>
  {:else}
    <div class="progress">
      Task {currentTaskIndex + 1} of {tasks.length}
      {#if isCompleted}
        <span class="completed">(Completed!)</span>
      {/if}
    </div>
    
    <div class="info">
      Tasks are evaluated automatically and progressed upon fulfilling the condition
    </div>

    <div class="tasks">
      {#each tasks as task, index (index)}
        {@const isTaskCompleted = index < currentTaskIndex || (isCompleted && index === currentTaskIndex)}
        {@const isActive = index === currentTaskIndex && !isCompleted}
        <div 
          class="task" 
          class:active={isActive}
          class:completed={isTaskCompleted}
          bind:this={activeTaskElements[index]}
        >
          <div class="task-text">{task.text}</div>
          
          {#if isActive && task.buttonText && task.onButtonClick}
            <button 
              class="task-button"
              onclick={task.onButtonClick}
            >
              {task.buttonText}
            </button>
          {/if}
        </div>
      {/each}
      
    </div>

    <div class="skip-section">
      <div class="skip-header">
        <h3 class="skip-heading">
          {#if isCompleted}
            All tasks completed
          {:else}
            Skip current task
          {/if}
        </h3>
        <p class="skip-instructions" class:unskippable={!isCurrentTaskSkippable && !isCompleted}>
          {#if isCompleted}
            Thank you for completing all tasks. Please save your session information below.
          {:else if isCurrentTaskSkippable}
            If you're unable to complete this task, you may skip it as a last resort. Please provide a reason below.
          {:else}
            This task is crucial and cannot be skipped. Please complete it to continue.
          {/if}
        </p>
      </div>

      {#if isCompleted}
        <div class="completion-info">
          <div class="session-details">
            <p class="session-label">Session ID:</p>
            <code class="session-code">{sessionId}</code>
            <p class="session-label">Contact for information and data withdrawal:</p>
            <a href="mailto:{consentWithdrawEmail}" class="session-email">{consentWithdrawEmail}</a>
          </div>
        </div>
      {/if}

      {#if !isCompleted}
        <div class="skip-input-container">
          <textarea
            bind:value={skipReason}
            class="skip-textarea"
            placeholder={isCurrentTaskSkippable ? "Why are you unable to complete this task?" : "This task cannot be skipped"}
            maxlength={SKIP_REASON_LIMIT}
            rows="3"
            disabled={!isCurrentTaskSkippable}
          ></textarea>
          
          <div class="skip-footer">
            <span class="char-count" class:at-limit={remainingChars <= 50}>
              {remainingChars} characters remaining
            </span>
            <button 
              class="skip-button"
              onclick={handleSkipTask}
              disabled={!canSkip || !isCurrentTaskSkippable}
            >
              Skip Task
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* --- Keep all original styles for .survey, .task, .progress, etc. --- */
  .survey {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty {
    text-align: center;
    color: var(--c-darkgrey);
    padding: 2rem;
  }

  .progress {
    text-align: center;
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: var(--c-black);
    font-size: 1.15rem;
  }

  .completed {
    color: var(--c-success);
    margin-left: 0.5rem;
  }

  .info {
    text-align: center;
    margin-bottom: 2rem;
    font-size: 0.85rem;
    color: var(--c-darkgrey);
    font-style: italic;
    max-width: 500px;
  }

  .tasks {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 500px;
  }

  .task {
    padding: 0.75rem 1rem 0.25rem 1rem;
    border: 2px solid var(--c-lightgrey);
    border-radius: var(--rounded-md);
    background: var(--c-white);
    transition: border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
    font-weight: 500;
    font-size: 0.9rem;
    text-align: center;
    position: relative;
    overflow: hidden;
    will-change: transform, border-color, background-color, box-shadow;
  }

  .task.active {
    border-color: var(--c-brand);
    background: var(--c-darkwhite);
    box-shadow: 0 0 0 3px rgba(205, 20, 4, 0.1);
    color: var(--c-brand-dark);
    transform: scale(1.02);
  }

  .task.completed {
    opacity: 0.6;
    background: var(--c-lightgrey);
    border-color: var(--c-lightgrey);
    transform: scale(1.02);
    box-shadow: none;
  }

  .task.completed .task-text {
    text-decoration: line-through;
    color: var(--c-darkgrey);
  }


  .task-text {
    margin-bottom: 0.5rem;
  }

  .task-button {
    display: block;
    margin: 0.5rem auto 0.25rem;
    padding: 0.5rem 1rem;
    background: var(--c-brand);
    color: white;
    border: none;
    border-radius: var(--rounded);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(205, 20, 4, 0.3);
    transform: translateY(0);
    font-size: 0.85rem;
  }

  .task-button:hover {
    background: var(--c-brand-dark);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(205, 20, 4, 0.4);
  }

  .task-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(205, 20, 4, 0.3);
  }


  /* --- Skip Section Styles --- */
  .skip-section {
    margin-top: 2.5rem;
    padding: 1.5rem 0;
    border-top: 2px solid var(--c-lightgrey);
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 500px;
    /* Fixed height to prevent layout shifts */
    height: 16rem;
    box-sizing: border-box;
  }

  .skip-header {
    text-align: center;
    margin-bottom: 1rem;
  }

  .skip-heading {
    font-size: 1rem;
    font-weight: 600;
    color: var(--c-black);
    margin: 0 0 0.5rem 0;
  }

  .skip-instructions {
    font-size: 0.85rem;
    color: var(--c-darkgrey);
    line-height: 1.5;
    margin: 0;
  }

  .skip-instructions.unskippable {
    color: var(--c-brand-dark);
    font-weight: 500;
  }

  .skip-input-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .skip-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--c-lightgrey);
    border-radius: var(--rounded-md);
    font-family: inherit;
    font-size: 0.85rem;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.3s ease, opacity 0.3s ease, background-color 0.3s ease;
    box-sizing: border-box;
    min-height: 4rem;
  }

  .skip-textarea:focus:not(:disabled) {
    outline: none;
    border-color: var(--c-darkgrey);
  }

  .skip-textarea::placeholder {
    color: var(--c-darkgrey);
    opacity: 0.6;
  }

  .skip-textarea:disabled {
    opacity: 0.5;
    background-color: var(--c-lightgrey);
    cursor: not-allowed;
  }

  .skip-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .char-count {
    color: var(--c-darkgrey);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .char-count.at-limit {
    color: var(--c-error);
    font-weight: 500;
  }

  .skip-button {
    padding: 0.6rem 1.25rem;
    background: var(--c-lightgrey);
    color: var(--c-darkgrey);
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .skip-button:hover:not(:disabled) {
    background: var(--c-darkgrey);
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  .skip-button:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .skip-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Completion info styles */
  .completion-info {
    padding: 1rem;
    background: #f0f9ff;
    border: 2px solid #0ea5e9;
    border-radius: var(--rounded-md);
    margin-top: 1rem;
  }

  .session-details {
    text-align: center;
  }

  .session-label {
    font-size: 0.85rem;
    color: var(--c-darkgrey);
    margin: 0.5rem 0 0.25rem 0;
    font-weight: 500;
  }

  .session-code {
    display: block;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    background: white;
    padding: 0.5rem 1rem;
    border-radius: var(--rounded-sm);
    color: #0ea5e9;
    font-weight: 600;
    letter-spacing: 0.05em;
    margin: 0.25rem auto 0.5rem;
    border: 1px solid #bae6fd;
    word-break: break-all;
  }

  .session-email {
    display: inline-block;
    color: var(--c-brand);
    font-weight: 500;
    text-decoration: underline;
    margin: 0.25rem 0 0.5rem 0;
  }

  .session-email:hover {
    color: var(--c-brand-dark);
  }

  .banner-task-label {
    font-weight: 700;
    font-size: 0.7rem;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    margin-bottom: 0.25rem;
    color: var(--c-brand);
    width: 100%;
  }

  .banner-text-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .banner-text {
    font-weight: 500;
    font-size: 0.9rem;
    text-align: center;
    /* Ensure the text doesn't interfere with flex centering */
    flex-shrink: 0;
  }

  .banner-button {
    padding: 0.5rem 1rem;
    background: var(--c-brand);
    color: white;
    border: none;
    border-radius: var(--rounded);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease, opacity 0.2s ease;
    font-size: 0.85rem;
    white-space: nowrap;
    min-width: 6rem; /* Prevent button width jitter */
    text-align: center;
  }

  .banner-button:hover {
    background: var(--c-brand-dark);
    transform: translateY(-1px);
  }

  .banner-button:active {
    transform: translateY(0);
  }

  @keyframes bannerSlideDown {
    0% {
      opacity: 0;
      transform: translateY(-100%);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes bannerSlideUp {
    0% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(-100%);
    }
  }

  /* --- SIMPLIFIED BANNER STYLES --- */
  .banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background-color: var(--c-lightgrey, #eaeaea);
    color: var(--c-black);
    padding: 0.75rem 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    animation: bannerSlideDown 0.3s ease-out;
    min-height: 3.5rem; /* Ensure banner doesn't jitter */
    display: flex;
    align-items: center;
    border-bottom: 1px solid #88888862;
    /* This is crucial: clips the in/out fly animations */
    overflow: hidden; 
  }

  .banner.hiding {
    animation: bannerSlideUp 0.3s ease-in forwards;
  }

  /* Banner content wrapper - relative container for absolute positioning */
  .banner-content-wrapper {
    position: relative;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    min-height: 1.25rem; /* Prevent banner height jitter */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Banner content - absolute positioned for animation, but centered within wrapper */
  .banner-content {
    position: absolute;
    width: 100%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }

  /* Mobile adjustments to prevent overflow and allow wrapping */
  @media only screen and (max-width: 540px) {
    .banner {
      padding: 0.9rem 0.85rem;
      min-height: 4.75rem;
    }
    .banner-content-wrapper {
      min-height: 2rem;
      padding-inline: 0.25rem;
    }
    .banner-text-row {
      flex-wrap: wrap;
      row-gap: 0.4rem;
    }
    .banner-text {
      /* Allow the textual instructions to wrap on small screens */
      flex: 1 1 100%;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
  }
</style>