/**
 * Survey task interface defining the structure of individual survey tasks
 * @interface SurveyTask
 */
export interface SurveyTask {
  /** The text content of the survey task */
  text: string;
  /** Optional button text for the active task */
  buttonText?: string;
  /** Optional callback function when button is clicked */
  onButtonClick?: () => void;
}

/**
 * Survey state interface defining the complete survey state
 * @interface SurveyState
 */
export interface SurveyState {
  /** Array of survey tasks in sequential order - cannot be changed once set */
  readonly tasks: readonly SurveyTask[];
  /** Index of the currently active/highlighted task */
  currentActiveTaskIndex: number;
  /** Whether the survey has been completed */
  isCompleted: boolean;
}

/**
 * Survey actions interface defining available survey operations
 * @interface SurveyActions
 */
export interface SurveyActions {
  /** Set the survey tasks array (can only be called once) */
  setTasks: (tasks: SurveyTask[]) => void;
  /** Move to the next task (called externally when task is completed) */
  nextTask: () => void;
}
