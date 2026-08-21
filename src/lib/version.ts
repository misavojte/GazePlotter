/** Hosts that skip the `__APP_VERSION__` define get 'unknown', not a crash. */
export const GAZEPLOTTER_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'
