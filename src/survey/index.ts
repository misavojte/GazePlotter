/**
 * Survey module - simplified, SSR-first approach
 */

// Export types
export type { SurveyTask, SurveyState, SurveyActions } from './types/index';

// Export store
export { surveyStore } from './stores/index';

// Export components
export { Survey, ConsentModal } from './components/index';

// Export utilities
export { createCondition } from './utils/index';