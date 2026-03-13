import type { SurveyTask } from '$survey/types/index'

/**
 * Survey store class using Svelte 5 runes for state management.
 * This provides a more integrated and reactive experience than legacy writable stores.
 */
class SurveyStore {
  #tasks = $state<readonly SurveyTask[]>([])
  #currentActiveTaskIndex = $state(-1)
  #isCompleted = $state(false)
  #tasksInitialized = false

  // Getters for read-only access to state
  get tasks() {
    return this.#tasks
  }
  get currentActiveTaskIndex() {
    return this.#currentActiveTaskIndex
  }
  get isCompleted() {
    return this.#isCompleted
  }

  /**
   * Set the survey tasks array - can only be called once
   * @param newTasks - Array of survey tasks to set
   * @throws Error if tasks have already been initialized
   */
  setTasks(newTasks: SurveyTask[]): void {
    if (this.#tasksInitialized) {
      throw new Error('Survey tasks cannot be modified after initialization')
    }

    // Create readonly copy of tasks array
    this.#tasks = Object.freeze([...newTasks]) as readonly SurveyTask[]
    this.#currentActiveTaskIndex = newTasks.length > 0 ? 0 : -1
    this.#isCompleted = false
    this.#tasksInitialized = true
  }

  /**
   * Move to the next task in the sequence
   */
  nextTask(): void {
    if (this.#tasks.length === 0 || this.#isCompleted) {
      return
    }

    const nextIndex = this.#currentActiveTaskIndex + 1
    const isLastTask = nextIndex >= this.#tasks.length

    if (isLastTask) {
      this.#isCompleted = true
    } else {
      this.#currentActiveTaskIndex = nextIndex
    }
  }

  /**
   * Skip the current task if it is skippable
   */
  skipTask(): void {
    if (this.#tasks.length === 0 || this.#isCompleted) {
      return
    }

    const currentTask = this.#tasks[this.#currentActiveTaskIndex]
    const isSkippable = currentTask?.skippable !== false

    if (!isSkippable) {
      return
    }

    const nextIndex = this.#currentActiveTaskIndex + 1
    const isLastTask = nextIndex >= this.#tasks.length

    if (isLastTask) {
      this.#isCompleted = true
    } else {
      this.#currentActiveTaskIndex = nextIndex
    }
  }
}

/**
 * Main survey store instance (Singleton)
 */
export const surveyStore = new SurveyStore()
