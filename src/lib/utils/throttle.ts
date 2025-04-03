/**
 * Throttles a function using requestAnimationFrame.
 * Ensures the function is called at most once per rendering frame.
 * Uses the latest arguments provided before the frame callback.
 *
 * @param {Function} func The function to throttle.
 * @returns {Function} The throttled function.
 */
export function throttleByRaf<T extends (...args: any[]) => void>(
  func: T
): (this: any, ...args: Parameters<T>) => void {
  let ticking = false
  let lastArgs: Parameters<T> | null = null
  // Store the correct 'this' context if necessary
  let context: any = null

  return function (this: any, ...args: Parameters<T>) {
    lastArgs = args // Always store the latest arguments
    context = this // Capture the context in which the throttled function was called

    if (!ticking) {
      requestAnimationFrame(() => {
        if (lastArgs !== null) {
          // Use the captured context and latest arguments
          func.apply(context, lastArgs)
          lastArgs = null // Clear args after execution
          context = null // Clear context
        }
        ticking = false
      })
      ticking = true
    }
  }
}
