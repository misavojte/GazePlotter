<script lang="ts">
  import { surveyStore } from '$survey/stores/surveyStore';
  import type { SurveyTask } from '$survey/types/index';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';

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

  // --- State for Banner Visibility ---
  let showBanner = $state(false);
  let bannerHiding = $state(false);
  let activeTaskElements: (HTMLElement | null)[] = $state([]);
  

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
        {@const isTaskCompleted = index < currentTaskIndex}
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
      
      {#if isCompleted}
        <div class="completion">🎉 All tasks completed!</div>
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
    margin-bottom: 1.5rem;
    font-weight: 600;
    color: var(--c-black);
    font-size: 1rem;
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

  .completion {
    text-align: center;
    padding: 1.25rem;
    background: var(--c-success);
    color: white;
    border: 2px solid var(--c-success);
    border-radius: var(--rounded-md);
    margin-top: 0.75rem;
    font-weight: 500;
    font-size: 0.9rem;
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
    background: white;
    color: var(--c-brand);
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
    background: var(--c-darkwhite);
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
    background: var(--c-brand);
    color: white;
    padding: 0.75rem 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    animation: bannerSlideDown 0.3s ease-out;
    min-height: 3.5rem; /* Ensure banner doesn't jitter */
    display: flex;
    align-items: center;
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
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }
</style>