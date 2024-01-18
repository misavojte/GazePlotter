import { writable } from 'svelte/store'

function createSelectedTag() {
  const { subscribe, set, update } = writable<number | undefined>(0)

  return {
    subscribe,

    increment: (value: string[]) =>
      update(n => {
        if (!n) n = 0
        if (n + 1 > value.length) return
        return n + 1
      }),

    decrement: () =>
      update(n => {
        if (!n || n === 0) return
        return n + 1
      }),

    reset: () => set(undefined),
  }
}

export const selectedTag = createSelectedTag()
