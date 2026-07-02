import { untrack } from 'svelte'

/**
 * The reactive/plain boundary for plot data derivation.
 *
 * A plot container derives its transform result through `usePlotData`, which
 * makes the derivation's reactive dependency surface fully explicit — exactly
 * three inputs, nothing discovered implicitly inside the transform:
 *
 *  1. `epoch`    — `item.redrawTimestamp`. Bumped by every engine-data command
 *                  (and by the item's own settings updates). "Engine data
 *                  changed, re-derive." Layout move/resize never bumps it.
 *  2. `settings` — read reactively here, then handed to `derive` as a plain,
 *                  deeply-frozen snapshot. Re-derivation is gated on deep
 *                  equality, so settings churn that doesn't change content
 *                  (or touches only `viewOnly` keys) never re-runs the
 *                  transform.
 *  3. `watch`    — layout / cross-plot inputs the derivation reads that are
 *                  neither settings nor engine data (`item.w`, `grid.items`).
 *                  Rare: most plots need none. `engine.metadata` is NEVER
 *                  watched — every metadata mutation is a workspace command
 *                  (epoch bump), and dataset loads rebuild all grid items
 *                  after the engine is loaded, so a live container cannot
 *                  observe a metadata transition.
 *
 * `derive` itself runs UNTRACKED: reads of `engine.metadata`, grid items, or
 * other rune state inside the transform register no dependencies. Transforms
 * therefore never see a `$state` proxy — no per-property proxy `get` cost in
 * hot loops, no accidental dependency webs, and no need to hold results in
 * `$state.raw` (the result lives outside the proxy layer entirely; `$derived`
 * does not deep-proxy its value).
 */
export interface PlotDataOptions<TSettings extends object, TResult> {
  /** The engine-data epoch: `() => item.redrawTimestamp`. */
  epoch: () => number
  /** Reactive settings read; the value is snapshotted before `derive` sees it. */
  settings: () => TSettings
  /**
   * Settings keys the derivation provably never reads (view-only state such
   * as `highlights`). Changes to these keys never re-run `derive`.
   */
  viewOnly?: readonly string[]
  /**
   * Layout / cross-plot reactive dependencies, declared by reading them here
   * (return value is ignored) — `item.w` for width-dependent display budgets,
   * `grid.items` for cross-plot sync scans. Anything the derivation consumes
   * reactively besides settings and the epoch MUST be read here or the plot
   * goes stale. Engine data never belongs here: it is covered by `epoch`.
   */
  watch?: () => unknown
  /** Pure derivation. `settings` is a plain, deeply-frozen snapshot. */
  derive: (settings: TSettings) => TResult
}

export interface PlotDataHandle<TResult> {
  readonly current: TResult
}

/**
 * The snapshot gate: turns successive reads of reactive settings into plain,
 * deeply-frozen snapshots with a STABLE REFERENCE under noise — when a re-read
 * produces deep-equal content (e.g. a `viewOnly` key changed, or an unrelated
 * spread rebuilt the object), the previous snapshot object is returned so
 * downstream derivation is not invalidated. Pure apart from `$state.snapshot`;
 * exported for unit tests.
 */
export function createSettingsGate<TSettings extends object>(
  viewOnly?: readonly string[]
): (raw: TSettings) => TSettings {
  let last: TSettings | undefined
  return raw => {
    const next = plainClone(raw)
    if (viewOnly) {
      for (const key of viewOnly) {
        delete (next as Record<string, unknown>)[key]
      }
    }
    if (last !== undefined && deepEqual(next, last)) return last
    last = deepFreeze(next)
    return next
  }
}

/**
 * Deep clone of plain settings data (objects/arrays/primitives), reading
 * every property — through a `$state` proxy this both unwraps the proxy and
 * registers the tracked reads that invalidate the gate. Deliberately not
 * `$state.snapshot`: that is identity under server compile, and its tracking
 * behaviour is an internal detail we must not depend on.
 */
function plainClone<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) {
    const out = new Array(value.length)
    for (let i = 0; i < value.length; i++) out[i] = plainClone(value[i])
    return out as T
  }
  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source)) out[key] = plainClone(source[key])
  return out as T
}

export function usePlotData<TSettings extends object, TResult>(
  options: PlotDataOptions<TSettings, TResult>
): PlotDataHandle<TResult> {
  const gate = createSettingsGate<TSettings>(options.viewOnly)
  const settingsSnapshot = $derived.by(() => gate(options.settings()))

  const current = $derived.by(() => {
    void options.epoch()
    void options.watch?.()
    const settings = settingsSnapshot
    return untrack(() => options.derive(settings))
  })

  return {
    get current() {
      return current
    },
  }
}

/**
 * Plain, deeply-frozen snapshot of a reactive settings object — for boundary
 * call sites that hand settings to a transform outside `usePlotData` (the
 * export modal's `deriveView`, figure props).
 */
export function snapshotSettings<T extends object>(settings: T): T {
  return deepFreeze(plainClone(settings))
}

/** Structural equality over snapshot data (plain objects/arrays/primitives). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) && Number.isNaN(b)
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false
  }
  const aIsArray = Array.isArray(a)
  if (aIsArray !== Array.isArray(b)) return false
  if (aIsArray) {
    const arrA = a as unknown[]
    const arrB = b as unknown[]
    if (arrA.length !== arrB.length) return false
    for (let i = 0; i < arrA.length; i++) {
      if (!deepEqual(arrA[i], arrB[i])) return false
    }
    return true
  }
  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>
  const keysA = Object.keys(objA)
  if (keysA.length !== Object.keys(objB).length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false
    if (!deepEqual(objA[key], objB[key])) return false
  }
  return true
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  Object.freeze(value)
  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}
