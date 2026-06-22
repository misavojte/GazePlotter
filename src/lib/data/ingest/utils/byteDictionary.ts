import { bytesEqual } from './byteUtils'

/**
 * Insertion-ordered interner for byte strings: `getId` returns a stable,
 * dense id per distinct value (assigning the next id on first sight), and
 * `getValues` returns the values in id order. Used to intern stimulus,
 * participant, AOI, and eye-movement-category names during ingest without
 * decoding to JS strings on the hot path.
 */
export class ByteDictionary {
  private items: Uint8Array[] = []
  private hashMap = new Map<number, number[]>()

  getId(value: Uint8Array): number {
    const hash = this.hashBytes(value)
    const existing = this.hashMap.get(hash)
    if (existing) {
      for (let i = 0; i < existing.length; i++) {
        const id = existing[i]
        if (bytesEqual(value, this.items[id])) return id
      }
    }
    const id = this.items.length
    this.items.push(value)
    if (existing) existing.push(id)
    else this.hashMap.set(hash, [id])
    return id
  }

  getValues(): Uint8Array[] {
    return this.items
  }

  /** Lookup-only: id of an existing value, or -1. Never inserts. */
  findId(value: Uint8Array): number {
    const existing = this.hashMap.get(this.hashBytes(value))
    if (existing) {
      for (let i = 0; i < existing.length; i++) {
        if (bytesEqual(value, this.items[existing[i]])) return existing[i]
      }
    }
    return -1
  }

  private hashBytes(bytes: Uint8Array): number {
    let hash = 2166136261
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i]
      hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
  }
}
