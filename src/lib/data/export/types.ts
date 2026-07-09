/**
 * Whether exported names reflect the user's display transformations — renames
 * (displayed name), grouping (entities merged by displayed name), and derived
 * interval event channels — or the raw imported data (original names, no
 * grouping, original channels only). 'displayed' is the default everywhere.
 */
export type ExportNaming = 'displayed' | 'raw'
