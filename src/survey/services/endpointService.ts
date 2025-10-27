/**
 * Configuration interface for HTTP POST endpoint setup
 * @interface EndpointConfig
 */
export interface EndpointConfig {
  /** HTTP POST endpoint URL for submitting survey data */
  endpoint: string;
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
  /** Optional session ID for grouping related entries */
  sessionId?: string;
}

/**
 * Service response interface
 * @interface ServiceResponse
 */
export interface ServiceResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Generated key for the stored data */
  key?: string;
}

/**
 * HTTP POST service class for handling survey data storage
 * 
 * This service provides methods to:
 * - Initialize service with endpoint URL
 * - Store survey data entries via HTTPS POST
 * - Handle data flattening for JSON transmission
 * 
 * @example
 * ```typescript
 * // Initialize the service
 * const endpointService = new EndpointService();
 * await endpointService.initialize({ endpoint: 'https://api.example.com/submit' });
 * 
 * // Store survey data
 * const response = await endpointService.storeSurveyData({
 *   type: 'survey_response',
 *   timestamp: Date.now(),
 *   data: { question: 'How satisfied are you?', answer: 'Very satisfied' }
 * });
 * ```
 */
export class EndpointService {
  private endpoint: string | null = null;
  private isInitialized = false;
  private sessionId: string;
  private lastSubmissionTimestamp: number = 0;
  
  // localStorage key for storing last submission timestamp
  private readonly LAST_SUBMISSION_KEY = 'endpointService_lastSubmission';

  /**
   * Constructor - generates unique session ID
   */
  constructor() {
    // Generate a unique session ID for this instance
    this.sessionId = this.generateSessionId();
  }

  /**
   * Initialize service with the provided endpoint URL
   * 
   * @param config - Configuration object with endpoint URL
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   * 
   * @example
   * ```typescript
   * const config = {
   *   endpoint: 'https://your-server.com/api/survey'
   * };
   * 
   * await endpointService.initialize(config);
   * ```
   */
  async initialize(config: EndpointConfig): Promise<void> {
    try {
      // Validate endpoint URL
      if (!config.endpoint || typeof config.endpoint !== 'string') {
        throw new Error('Invalid endpoint URL provided');
      }

      // Validate URL format
      new URL(config.endpoint);

      this.endpoint = config.endpoint;

        // try to get last submission timestamp from localStorage
        // if localStorage item is not found, set lastSubmissionTimestamp to 0
        const lastSubmissionTimestamp = localStorage?.getItem(this.LAST_SUBMISSION_KEY) || '0';
        this.lastSubmissionTimestamp = parseInt(lastSubmissionTimestamp) || 0;

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store survey data entry via HTTPS POST request
   * All data is flattened and sent as JSON
   * The receiving server will use the sessionId to organize JSONs into folders
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
   * const response = await endpointService.storeSurveyData(entry);
   * if (response.success) {
   *   console.log('Data stored with key:', response.key);
   * }
   * ```
   */
  async storeSurveyData(entry: SurveyDataEntry): Promise<ServiceResponse> {
    if (!this.isInitialized || !this.endpoint) {
      return {
        success: false,
        error: 'Service not initialized'
      };
    }

    try {
      // Prepare the data with session ID and flatten everything
      const payload = {
        sessionId: entry.sessionId || this.sessionId,
        type: entry.type,
        timestamp: entry.timestamp,
        lastSubmissionTimestamp: this.lastSubmissionTimestamp,
        // Flatten nested data into the root level
        ...this.flattenObject(entry.data)
      };

      console.info("Sending payload to endpoint:", payload);
      // Send HTTPS POST request
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP error! status: ${response.status}`
        };
      }

      // Try to parse response JSON if available
      let responseData;
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }

      // store last submission timestamp in localStorage
      localStorage?.setItem(this.LAST_SUBMISSION_KEY, Date.now().toString());

      return {
        success: true,
        key: responseData?.key || responseData?.id || responseData?.messageId || undefined
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
   * const responses = await endpointService.storeMultipleSurveyData(entries);
   * ```
   */
  async storeMultipleSurveyData(entries: SurveyDataEntry[]): Promise<ServiceResponse[]> {
    const promises = entries.map(entry => this.storeSurveyData(entry));
    return Promise.all(promises);
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
   * Flatten a nested object to a single-level object with dot notation keys
   * 
   * @private
   * @param obj - The object to flatten
   * @param prefix - Optional prefix for keys
   * @returns Flattened object
   * 
   * @example
   * { user: { name: 'John', age: 30 } } => { 'user.name': 'John', 'user.age': 30 }
   */
  private flattenObject(obj: Record<string, any>, prefix: string = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    // Iterate through all keys in the object
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        // Check if the value is an object (but not an array)
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          // Recursively flatten nested objects
          const nested = this.flattenObject(value, newKey);
          Object.assign(flattened, nested);
        } else {
          // For primitives and arrays, add directly
          flattened[newKey] = value;
        }
      }
    }

    return flattened;
  }

  /**
   * Generate a unique session ID
   * 
   * @private
   * @returns Unique session ID string
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Default HTTP POST service instance
 * Use this instance throughout the application
 */
export const endpointService = new EndpointService();

