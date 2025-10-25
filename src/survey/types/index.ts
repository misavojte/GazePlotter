import type { Readable } from 'svelte/store';

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
  /** Optional condition store that when true, automatically completes the task */
  condition?: Readable<boolean>;
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

/**
 * UEQS (User Experience Questionnaire Short) results interface
 * @interface UEQSResults
 */
export interface UEQSResults {
  /** Usual vs Leading-edge scale (-3 to +3) */
  'usual-leading': number;
  /** Boring vs Exciting scale (-3 to +3) */
  'boring-exciting': number;
  /** Complicated vs Easy scale (-3 to +3) */
  'complicated-easy': number;
  /** Confusing vs Clear scale (-3 to +3) */
  'confusing-clear': number;
  /** Obstructive vs Supportive scale (-3 to +3) */
  'obstructive-supportive': number;
  /** Not interesting vs Interesting scale (-3 to +3) */
  'not-interesting-interesting': number;
  /** Conventional vs Inventive scale (-3 to +3) */
  'conventional-inventive': number;
  /** Inefficient vs Efficient scale (-3 to +3) */
  'inefficient-efficient': number;
}
