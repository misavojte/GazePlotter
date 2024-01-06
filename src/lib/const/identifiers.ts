/**
 * Used to identify the type of segments in scarf plots.
 * It is used for styling and filtering via CSS selectors.
 *
 * @property {string} IDENTIFIER_IS_AOI - The segment is an AOI.
 * @property {string} IDENTIFIER_IS_OTHER_CATEGORY - The segment is a category other than AOI.
 * @property {string} IDENTIFIER_NOT_DEFINED - The segment is not defined, used with IDENTIFIER_IS_OTHER_CATEGORY or IDENTIFIER_IS_AOI.
 *
 * In following examples:
 * - IDENTIFIER_IS_AOI is 'a'
 * - IDENTIFIER_IS_OTHER_CATEGORY is 'ac'
 * - IDENTIFIER_NOT_DEFINED is 'N'
 *
 * @example <rect class="a1" ...></rect> - The segment is an AOI with id 1.
 * @example <rect class="ac2" ...></rect> - The segment is a category other than AOI, id of that category is 1.
 * @example <rect class="aN" ...></rect> - The segment is a fixation without AOI.
 * @example <rect class="acN" ...></rect> - The segment is a fixation with category other than AOI which is not defined.
 */
export const IDENTIFIER_IS_AOI = 'a'
export const IDENTIFIER_IS_OTHER_CATEGORY = 'ac'
export const IDENTIFIER_NOT_DEFINED = 'N'
