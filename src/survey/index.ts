/**
 * Survey module - simplified, SSR-first approach
 */

// Export types
export type { SurveyTask, SurveyState, SurveyActions, UEQSResults, EyeTrackingExperienceResult } from './types/index';
export { EyeTrackingExperience } from './types/index';

// Export store
export { surveyStore } from './stores/index';

// Export components
export { Survey, ConsentModal, SurveyModal } from './components/index';

// Export utilities
export { createCondition } from './utils/index';

// Export Firebase service
export { 
  FirebaseService, 
  firebaseService,
  type FirebaseConfig,
  type SurveyDataEntry,
  type FirebaseServiceResponse
} from './services/index';