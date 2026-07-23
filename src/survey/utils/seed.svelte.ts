/**
 * Seed helper for survey questions
 */

export function createSeededState<T>(
  getInitialValue: () => T,
  fallback: T
) {
  let value = $state<T>(fallback)
  let seeded = false

  $effect(() => {
    if (seeded) return
    value = getInitialValue() ?? fallback
    seeded = true
  })

  return {
    get current() {
      return value
    },
    set current(v: T) {
      value = v
    },
  }
}
