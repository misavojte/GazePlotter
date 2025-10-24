<script lang="ts">
  import { surveyStore } from './stores/surveyStore.js';
  import type { SurveyTask } from './types/index.js';
  import { browser } from '$app/environment';

  /**
   * Props for the Survey component
   */
  interface Props {
    /** Array of survey tasks (required for SSR) */
    tasks: SurveyTask[];
    /** Optional CSS class for custom styling */
    class?: string;
  }

  let { tasks, class: className = '' }: Props = $props();

  // Initialize survey tasks - SSR-first approach (built into component)
  $effect(() => {
    if (tasks.length > 0) {
      try {
        surveyStore.setTasks(tasks);
      } catch (error) {
        // Tasks already initialized, which is fine for SSR
      }
    }
  });

  // Subscribe to survey state
  const surveyState = $derived($surveyStore);
  const currentTask = $derived(surveyState.tasks[surveyState.currentActiveTaskIndex]);
  const isCompleted = $derived(surveyState.isCompleted);

  // Sticky scroll behavior
  let isSticky = $state(false);
  let activeTaskElements: (HTMLElement | null)[] = $state([]);
  let originalTop = 0;

  $effect(() => {
    if (!browser || isCompleted) return;

    const handleScroll = () => {
      const activeTaskElement = activeTaskElements[surveyState.currentActiveTaskIndex];
      if (activeTaskElement) {
        const rect = activeTaskElement.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        
        // Check if the active task has scrolled past the top of viewport
        if (!isSticky && rect.top <= 16) { // 1rem = 16px
          originalTop = scrollTop + rect.top;
          isSticky = true;
        } else if (isSticky && scrollTop < originalTop - 16) {
          isSticky = false;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });

  // Simple derived key that changes when task changes while sticky
  const stickyCloneKey = $derived(
    isSticky ? surveyState.currentActiveTaskIndex : 0
  );

  // Monitor conditions for automatic task completion
  $effect(() => {
    if (!browser || isCompleted) return;

    const currentTask = surveyState.tasks[surveyState.currentActiveTaskIndex];
    if (!currentTask?.condition) return;

    const unsubscribe = currentTask.condition.subscribe((conditionMet) => {
      if (conditionMet) {
        surveyStore.nextTask();
      }
    });

    return unsubscribe;
  });
</script>

<!-- 
  Simplified survey component with SSR-first approach
  Displays tasks with active task highlighted by brand color framing
-->

<!-- Sticky clone at the top when scrolled -->
{#if isSticky && currentTask && !isCompleted}
  {#key stickyCloneKey}
    <div class="sticky-clone">
      <div class="sticky-container">
        <div class="task active">
          <div class="task-text">{currentTask.text}</div>
          
          <!-- Button for sticky clone -->
          <div class="button-container" class:show={currentTask.buttonText && currentTask.onButtonClick}>
            {#if currentTask.buttonText && currentTask.onButtonClick}
              <button 
                class="task-button"
                onclick={currentTask.onButtonClick}
              >
                {currentTask.buttonText}
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/key}
{/if}

<div class="survey" class:className>
  {#if tasks.length === 0}
    <div class="empty">No survey tasks available</div>
  {:else}
    <!-- Progress indicator -->
    <div class="progress">
      Task {surveyState.currentActiveTaskIndex + 1} of {tasks.length}
      {#if isCompleted}
        <span class="completed">(Completed!)</span>
      {/if}
    </div>
    
    <!-- Info about automatic progression -->
    <div class="info">
      Tasks are evaluated automatically and progressed upon fulfilling the condition
    </div>

    <!-- Tasks list -->
    <div class="tasks">
      {#each tasks as task, index (index)}
        {@const isTaskCompleted = index < surveyState.currentActiveTaskIndex}
        {@const isLastTask = index === tasks.length - 1}
        <div 
          class="task" 
          class:active={index === surveyState.currentActiveTaskIndex && !isCompleted}
          class:completed={isTaskCompleted || (isLastTask && isCompleted)}
          class:hidden={index === surveyState.currentActiveTaskIndex && isSticky && !isCompleted}
          bind:this={activeTaskElements[index]}
        >
          <div class="task-text">{task.text}</div>
          
          <!-- Button shown only for active task with smooth height animation -->
          <div class="button-container" class:show={index === surveyState.currentActiveTaskIndex && task.buttonText && task.onButtonClick && !isCompleted}>
            {#if index === surveyState.currentActiveTaskIndex && task.buttonText && task.onButtonClick && !isCompleted}
              <button 
                class="task-button"
                onclick={task.onButtonClick}
              >
                {task.buttonText}
              </button>
            {/if}
          </div>
        </div>
      {/each}
      
      <!-- Completion message -->
      {#if isCompleted}
        <div class="completion">🎉 All tasks completed!</div>
      {/if}
    </div>
  {/if}
</div>

<style>
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
    font-size: 1.1rem;
  }

  .completed {
    color: var(--c-success);
    margin-left: 0.5rem;
  }

  .info {
    text-align: center;
    margin-bottom: 2rem;
    font-size: 0.9rem;
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
    transition: all 0.3s ease;
    font-weight: 500;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .task.active {
    border-color: var(--c-brand);
    background: var(--c-darkwhite);
    box-shadow: 0 0 0 3px rgba(205, 20, 4, 0.1);
    color: var(--c-brand-dark);
    transform: scale(1.02);
  }

  .task.hidden {
    visibility: hidden;
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

  .sticky-clone {
    position: fixed;
    top: 1rem;
    left: 0;
    right: 0;
    z-index: 1000;
    pointer-events: none;
  }

  .sticky-container {
    max-width: 500px;
    margin: 0 auto;
    padding: 0 1rem;
    pointer-events: auto;
  }

  .sticky-clone .task {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    padding: 0.75rem 1rem 0.25rem 1rem;
    animation: stickyAppear 0.3s ease-out;
    box-sizing: border-box;
  }

  .sticky-clone .task-button {
    margin: 0.5rem auto 0.25rem;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }

  @keyframes stickyAppear {
    0% {
      opacity: 0;
      transform: translateY(-10px) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1.02);
    }
  }

  .task-text {
    margin-bottom: 0.5rem;
  }

  .button-container {
    height: 0;
    overflow: hidden;
    transition: height 0.4s ease-out;
  }

  .button-container.show {
    height: 50px; /* Approximate height of button + margins */
  }

  .task-button {
    display: block;
    margin: 0.5rem auto 0.25rem;
    padding: 0.5rem 1rem;
    background: var(--c-brand);
    color: white;
    border: none;
    border-radius: var(--rounded);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(205, 20, 4, 0.3);
    transform: translateY(0);
    font-size: 0.9rem;
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
    font-weight: 600;
    animation: completionReveal 0.6s ease-out;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
    transform: scale(1.02);
  }

  @keyframes completionReveal {
    0% {
      opacity: 0;
      transform: scale(0.9) translateY(10px);
    }
    100% {
      opacity: 1;
      transform: scale(1.02) translateY(0);
    }
  }
</style>
