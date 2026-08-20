/** Library version for the citation line and workspace metadata.
 *  `__APP_VERSION__` is a build-time define (this repo's vite config supplies
 *  it); hosts that skip the define get 'unknown' instead of a ReferenceError,
 *  so it is an option, not an obligation. */
export const GAZEPLOTTER_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'
