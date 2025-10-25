/**
 * Firebase service exports for survey data storage
 */

// Export the main service class and instance
export { FirebaseService, firebaseService } from './firebaseService';

// Export types
export type { 
  FirebaseConfig, 
  SurveyDataEntry, 
  FirebaseServiceResponse 
} from './firebaseService';
