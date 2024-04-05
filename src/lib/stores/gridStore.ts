import { writable, get } from 'svelte/store'
import type { AllGridTypes } from '$lib/type/gridType.ts'

export type GridStoreType = ReturnType<typeof createGridStore>

export const createGridStore = (
  initialItems: AllGridTypes[],
  getNewPosition: (w: number, h: number) => { x: number; y: number }
) => {
  const store = writable<AllGridTypes[]>(initialItems)

  const removeItem = (id: number) => {
    store.update(items => items.filter(item => item.id !== id))
    if (get(store).length === 0) {
      store.set([
        {
          id: 0,
          x: 3,
          y: 0,
          w: 6,
          h: 5,
          min: { w: 3 },
          type: 'empty',
        },
      ])
    }
  }

  const getNewId = () => {
    return Date.now() + Math.floor(Math.random() * 1000)
  }

  const duplicateItem = (item: AllGridTypes) => {
    // generate new, unique id
    const newId = getNewId()
    const newItem = { ...item, id: newId }
    addItem(newItem)
  }

  const addItem = (item: AllGridTypes) => {
    const newPosition = getNewPosition(item.w, item.h)
    const newX = newPosition ? newPosition.x : 0
    const newY = newPosition ? newPosition.y : 0
    store.update(items =>
      items.concat({
        ...item,
        id: getNewId(),
        x: newX,
        y: newY,
      })
    )
  }

  const updateSettings = (settings: AllGridTypes) => {
    store.update(items =>
      items.map(item => {
        if (item.id === settings.id) {
          return { ...item, ...settings }
        }
        return item
      })
    )
  }

  return {
    subscribe: store.subscribe,
    set: store.set,
    update: store.update,
    updateSettings,
    removeItem,
    duplicateItem,
  }
}
