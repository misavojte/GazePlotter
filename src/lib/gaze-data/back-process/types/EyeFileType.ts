/**
 * Types of eye tracking files accepted by the application.
 * Determines which deserializer is used to parse the file.
 *
 * Except for the 'unknown' type, which is used when the type of the file is not known.
 */

export type EyeFileType = 'tobii' |
'gazepoint' |
'begaze' |
'unknown' |
'tobii-with-event' |
'ogama' |
'varjo' |
'csv' |
'csv-segmented'
