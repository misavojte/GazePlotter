import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, push, set } from 'firebase/database';

/**
 * Configuration interface for Firebase setup
 * @interface FirebaseConfig
 */
export interface FirebaseConfig {
  /** Firebase API key */
  apiKey: string;
  /** Firebase Auth domain */
  authDomain: string;
  /** Firebase project ID */
  projectId: string;
  /** Firebase storage bucket */
  storageBucket: string;
  /** Firebase messaging sender ID */
  messagingSenderId: string;
  /** Firebase app ID */
  appId: string;
  /** Firebase Realtime Database URL */
  databaseURL: string;
}

/**
 * Survey data entry interface for storing survey responses
 * @interface SurveyDataEntry
 */
export interface SurveyDataEntry {
  /** Type of survey data (e.g., 'response', 'interaction', 'completion') */
  type: string;
  /** Timestamp when the data was recorded */
  timestamp: number;
  /** JSON object containing the survey data */
  data: Record<string, any>;
  /** Optional user ID (will be set automatically for anonymous users) */
  userId?: string;
  /** Optional session ID for grouping related entries */
  sessionId?: string;
}

/**
 * Firebase service response interface
 * @interface FirebaseServiceResponse
 */
export interface FirebaseServiceResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Generated key for the stored data */
  key?: string;
}

/**
 * Firebase service class for handling survey data storage with anonymous authentication
 * 
 * This service provides methods to:
 * - Initialize Firebase with configuration
 * - Authenticate users anonymously
 * - Store survey data entries
 * - Handle authentication state changes
 * 
 * @example
 * ```typescript
 * // Initialize the service
 * const firebaseService = new FirebaseService();
 * await firebaseService.initialize(firebaseConfig);
 * 
 * // Store survey data
 * const response = await firebaseService.storeSurveyData({
 *   type: 'survey_response',
 *   timestamp: Date.now(),
 *   data: { question: 'How satisfied are you?', answer: 'Very satisfied' }
 * });
 * ```
 */
export class FirebaseService {
  private app: any = null;
  private auth: any = null;
  private database: any = null;
  private isInitialized = false;
  private currentUser: any = null;
  private sessionId: string;

  constructor() {
    // Generate a unique session ID for this instance
    this.sessionId = this.generateSessionId();
  }

  /**
   * Initialize Firebase with the provided configuration
   * 
   * @param config - Firebase configuration object
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   * 
   * @example
   * ```typescript
   * const config = {
   *   apiKey: "your-api-key",
   *   authDomain: "your-project.firebaseapp.com",
   *   projectId: "your-project-id",
   *   storageBucket: "your-project.appspot.com",
   *   messagingSenderId: "123456789",
   *   appId: "your-app-id",
   *   databaseURL: "https://your-project.firebaseio.com"
   * };
   * 
   * await firebaseService.initialize(config);
   * ```
   */
  async initialize(config: FirebaseConfig): Promise<void> {
    try {
      // Initialize Firebase app
      this.app = initializeApp(config);
      
      // Initialize Auth
      this.auth = getAuth(this.app);
      
      // Initialize Realtime Database
      this.database = getDatabase(this.app);
      
      // Set up authentication state listener
      this.setupAuthStateListener();
      
      // Sign in anonymously
      await this.signInAnonymously();
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Firebase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store survey data entry in Firebase Realtime Database
   * 
   * @param entry - Survey data entry to store
   * @returns Promise that resolves with service response
   * 
   * @example
   * ```typescript
   * const entry: SurveyDataEntry = {
   *   type: 'survey_completion',
   *   timestamp: Date.now(),
   *   data: {
   *     surveyId: 'user-satisfaction-2024',
   *     responses: [
   *       { question: 'How satisfied are you?', answer: 'Very satisfied' },
   *       { question: 'Would you recommend us?', answer: 'Yes' }
   *     ],
   *     completionTime: 120000 // 2 minutes in milliseconds
   *   },
   *   sessionId: 'session-123'
   * };
   * 
   * const response = await firebaseService.storeSurveyData(entry);
   * if (response.success) {
   *   console.log('Data stored with key:', response.key);
   * }
   * ```
   */
  async storeSurveyData(entry: SurveyDataEntry): Promise<FirebaseServiceResponse> {
    if (!this.isInitialized || !this.database) {
      return {
        success: false,
        error: 'Firebase service not initialized'
      };
    }

    if (!this.currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    try {
      // Create a reference to the survey data collection
      const surveyDataRef = ref(this.database, 'surveyData');
      
      // Add the entry with auto-generated key
      const newEntryRef = push(surveyDataRef);
      
      // Prepare the data with user ID and session ID
      const dataToStore = {
        ...entry,
        userId: this.currentUser.uid,
        sessionId: entry.sessionId || this.sessionId,
        createdAt: Date.now()
      };
      
      // Store the data
      await set(newEntryRef, dataToStore);
      
      return {
        success: true,
        key: newEntryRef.key || undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Store multiple survey data entries in a batch
   * 
   * @param entries - Array of survey data entries to store
   * @returns Promise that resolves with array of service responses
   * 
   * @example
   * ```typescript
   * const entries: SurveyDataEntry[] = [
   *   {
   *     type: 'question_viewed',
   *     timestamp: Date.now(),
   *     data: { questionId: 'q1', questionText: 'How are you today?' }
   *   },
   *   {
   *     type: 'answer_selected',
   *     timestamp: Date.now() + 1000,
   *     data: { questionId: 'q1', answer: 'Great' }
   *   }
   * ];
   * 
   * const responses = await firebaseService.storeMultipleSurveyData(entries);
   * ```
   */
  async storeMultipleSurveyData(entries: SurveyDataEntry[]): Promise<FirebaseServiceResponse[]> {
    const promises = entries.map(entry => this.storeSurveyData(entry));
    return Promise.all(promises);
  }

  /**
   * Get the current authenticated user
   * 
   * @returns Current user or null if not authenticated
   */
  getCurrentUser(): any {
    return this.currentUser;
  }

  /**
   * Get the current session ID
   * 
   * @returns Current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if the service is initialized
   * 
   * @returns True if service is initialized, false otherwise
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Sign in anonymously to Firebase Auth
   * 
   * @private
   * @returns Promise that resolves when sign-in is complete
   */
  private async signInAnonymously(): Promise<void> {
    if (!this.auth) {
      throw new Error('Auth not initialized');
    }

    try {
      await signInAnonymously(this.auth);
    } catch (error) {
      throw new Error(`Anonymous sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set up authentication state change listener
   * 
   * @private
   */
  private setupAuthStateListener(): void {
    if (!this.auth) {
      throw new Error('Auth not initialized');
    }

    onAuthStateChanged(this.auth, (user: any) => {
      this.currentUser = user;
      console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
    });
  }

  /**
   * Generate a unique session ID
   * 
   * @private
   * @returns Unique session ID string
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Default Firebase service instance
 * Use this instance throughout the application
 */
export const firebaseService = new FirebaseService();
