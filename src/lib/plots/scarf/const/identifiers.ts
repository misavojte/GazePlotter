/**
 * Semantic identifier prefixes for Scarf Plot elements.
 * Used for data binding, styling lookup, and interactive highlighting.
 */
export const SCARF_IDENTIFIERS = {
  AOI: 'a', // Segment is an Area of Interest fixation
  CATEGORY: 'ac', // Segment is a category (e.g. Saccade)
  EVENT: 'e', // Visibility event marker
  NOT_DEFINED: 'N', // Fallback for null/empty categories or AOIs
} as const
