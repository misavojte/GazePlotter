import { untrack } from 'svelte'

/**
 * Returns a new array with `item` toggled: removed if present, appended if absent.
 */
export function toggleInArray<T>(array: T[], item: T): T[] {
  return array.includes(item)
    ? array.filter(v => v !== item)
    : [...array, item]
}

const NO_PREVIEW = Symbol('no-preview')

type Equality<T> = (left: T, right: T) => boolean
type PreviewFields = Record<string, unknown>
type PreviewEqualsMap<TFields extends PreviewFields> = Partial<{
  [K in keyof TFields]: Equality<TFields[K]>
}>
type PreviewPatchBuilder<TFields extends PreviewFields, TPatch extends object> = (
  draft: Readonly<TFields>,
  committed: Readonly<TFields>
) => TPatch

class PreviewFieldState<T> {
  #getCommitted: () => T
  #equals: Equality<T>
  #preview: T | typeof NO_PREVIEW = $state(NO_PREVIEW)

  constructor(getCommitted: () => T, equals: Equality<T>) {
    this.#getCommitted = getCommitted
    this.#equals = equals
  }

  get value(): T {
    return this.#preview === NO_PREVIEW ? this.#getCommitted() : this.#preview
  }

  set value(value: T) {
    this.#preview = value
  }

  get isDirty(): boolean {
    return this.#preview !== NO_PREVIEW && !this.#equals(this.#preview, this.#getCommitted())
  }

  reset() {
    this.#preview = NO_PREVIEW
  }
}

type PreviewFieldMap<TFields extends PreviewFields> = {
  [K in keyof TFields]: PreviewFieldState<TFields[K]>
}

/**
 * Centralized typed preview state for plot menus.
 * It exposes bindable `fields`, a derived `draft`, and one typed `buildPatch()` entrypoint.
 */
export class PreviewModel<
  TFields extends PreviewFields,
  TPatch extends object = Partial<TFields>,
> {
  #getCommitted: () => TFields
  #buildPatch: PreviewPatchBuilder<TFields, TPatch>
  readonly fields: PreviewFieldMap<TFields>

  constructor(options: {
    getCommitted: () => TFields
    buildPatch: PreviewPatchBuilder<TFields, TPatch>
    equals?: PreviewEqualsMap<TFields>
  }) {
    this.#getCommitted = options.getCommitted
    this.#buildPatch = options.buildPatch

    const committed = options.getCommitted()
    const fields = {} as PreviewFieldMap<TFields>

    for (const key of Object.keys(committed) as (keyof TFields)[]) {
      fields[key] = new PreviewFieldState(
        () => this.#getCommitted()[key],
        options.equals?.[key] ?? Object.is
      ) as PreviewFieldMap<TFields>[typeof key]
    }

    this.fields = fields
  }

  get committed(): TFields {
    return this.#getCommitted()
  }

  get draft(): TFields {
    const draft = { ...this.committed } as TFields

    for (const key of Object.keys(this.fields) as (keyof TFields)[]) {
      draft[key] = this.fields[key].value
    }

    return draft
  }

  get isDirty(): boolean {
    for (const key of Object.keys(this.fields) as (keyof TFields)[]) {
      if (this.fields[key].isDirty) return true
    }
    return false
  }

  buildPatch(): TPatch | null {
    if (!this.isDirty) return null
    return this.#buildPatch(this.draft, this.committed)
  }

  resetAll() {
    for (const key of Object.keys(this.fields) as (keyof TFields)[]) {
      this.fields[key].reset()
    }
  }

  /**
   * Auto-diff fields that map 1:1 from preview to settings.
   * Returns a partial object with only the changed fields.
   */
  static buildSimplePatch<T extends PreviewFields>(
    draft: Readonly<T>,
    committed: Readonly<T>,
    keys: (keyof T)[]
  ): Partial<T> {
    const updates: Partial<T> = {}
    for (const key of keys) {
      if (draft[key] !== committed[key]) {
        updates[key] = draft[key]
      }
    }
    return updates
  }
}

