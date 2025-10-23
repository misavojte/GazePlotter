/**
 * Survey module - simplified, SSR-first approach
 */

// Export types
export type { SurveyTask, SurveyState, SurveyActions } from './types/index.js';

// Export store
export { surveyStore } from './stores/index.js';

// Export main component
export { default as Survey } from './Survey.svelte';

// Export survey components
export { default as ConsentModal } from './components/ConsentModal.svelte';

// Export condition utilities
export {
  createCondition
} from './conditions.js';