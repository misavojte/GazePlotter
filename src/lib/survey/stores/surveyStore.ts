import { writable, type Writable } from 'svelte/store';
import type { SurveyState, SurveyTask, SurveyActions } from '../types/index.js';

/**
 * Initial survey state with empty tasks array and no active task
 */
const initialSurveyState: SurveyState = {
  tasks: [],
  currentActiveTaskIndex: -1,
  isCompleted: false
};

/**
 * Survey store containing the survey state and actions
 * The tasks array is readonly and cannot be modified after initial setup
 */
function createSurveyStore() {
  const { subscribe, set, update }: Writable<SurveyState> = writable(initialSurveyState);
  
  let tasksInitialized = false;

  /**
   * Set the survey tasks array - can only be called once
   * @param newTasks - Array of survey tasks to set
   * @throws Error if tasks have already been initialized
   */
  const setTasks = (newTasks: SurveyTask[]): void => {
    if (tasksInitialized) {
      throw new Error('Survey tasks cannot be modified after initialization');
    }
    
    // Create readonly copy of tasks array
    const readonlyTasks = Object.freeze([...newTasks]) as readonly SurveyTask[];
    
    update(state => ({
      ...state,
      tasks: readonlyTasks,
      currentActiveTaskIndex: newTasks.length > 0 ? 0 : -1,
      isCompleted: false
    }));
    
    tasksInitialized = true;
  };

  /**
   * Move to the next task in the sequence
   * Called externally when the current task is completed
   */
  const nextTask = (): void => {
    update(state => {
      if (state.tasks.length === 0 || state.isCompleted) {
        return state;
      }
      
      const nextIndex = state.currentActiveTaskIndex + 1;
      const isLastTask = nextIndex >= state.tasks.length;
      
      return {
        ...state,
        currentActiveTaskIndex: isLastTask ? state.currentActiveTaskIndex : nextIndex,
        isCompleted: isLastTask
      };
    });
  };

  /**
   * Survey actions object containing all available operations
   */
  const actions: SurveyActions = {
    setTasks,
    nextTask
  };

  return {
    subscribe,
    ...actions
  };
}

/**
 * Main survey store instance
 * Use this store to access survey state and actions throughout the application
 */
export const surveyStore = createSurveyStore();