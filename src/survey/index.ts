/**
 * Survey module - simplified, SSR-first approach
 */

// Export types
export type { SurveyTask, SurveyState, SurveyActions, UEQSResults, EyeTrackingExperienceResult } from './types/index';
export { EyeTrackingExperience } from './types/index';

// Export store
export { surveyStore } from './stores/index';

// Export components
export { default as Survey } from './components/Survey.svelte';
export { consentModal } from './components/ConsentModal.definition';
export { surveyModal, type SurveyModalResult } from './components/SurveyModal.definition';

// Export utilities
export { createCondition } from './utils/index';

// Export endpoint service
export { 
  EndpointService, 
  endpointService,
  type EndpointConfig,
  type SurveyDataEntry,
  type ServiceResponse
} from './services/index';
