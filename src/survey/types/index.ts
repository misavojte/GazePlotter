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
  /** Whether this task can be skipped by the user - defaults to true if not specified */
  skippable?: boolean;
  /** Optional callback when task is skipped - receives task index and skip reason */
  onSkip?: (taskIndex: number, reason: string) => void;
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
  /** Skip the current task (only works if the task is skippable) */
  skipTask: () => void;
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

/**
 * Eye-tracking experience levels (ordinal scale)
 * @enum EyeTrackingExperience
 */
export enum EyeTrackingExperience {
  /** Less than 6 months of experience */
  LESS_THAN_6_MONTHS = '<6 months',
  /** 6 to 12 months of experience */
  SIX_TO_TWELVE_MONTHS = '6–12 months',
  /** 1 to 2 years of experience */
  ONE_TO_TWO_YEARS = '1–2 years',
  /** 3 to 5 years of experience */
  THREE_TO_FIVE_YEARS = '3–5 years',
  /** More than 5 years of experience */
  MORE_THAN_5_YEARS = '>5 years'
}

/**
 * Eye-tracking experience question result
 * @interface EyeTrackingExperienceResult
 */
export interface EyeTrackingExperienceResult {
  /** The selected experience level */
  experience: EyeTrackingExperience;
}

/**
 * Survey modal state interface - persists across modal closes/reopens
 * @interface SurveyModalState
 */
export interface SurveyModalState {
  /** Whether the survey has been completed */
  isCompleted: boolean;
  /** UEQS survey results */
  ueqsResults: UEQSResults | null;
  /** Eye-tracking experience results */
  eyeTrackingResults: EyeTrackingExperienceResult | null;
  /** User feedback text */
  feedbackText: string;
  /** Current step index in the modal flow */
  currentStepIndex: number;
  /** Whether UEQS step is complete */
  ueqsComplete: boolean;
  /** Current eye-tracking value (temporary until saved) */
  eyeTrackingValue: string | null;
  /** Current feedback value (temporary until saved) */
  feedbackValue: string;
}
