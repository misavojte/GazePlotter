import type { ParticipantsGroup } from '$lib/gaze-data/shared/types'
import { writable } from 'svelte/store'
import {
  getParticipantsGroups,
  data,
} from '$lib/gaze-data/front-process/stores/dataStore'

/**
 * Store for participants groups data in working memory of modal
 */
export const participantsGroupsStore = writable(getParticipantsGroups())

export const addGroup = (groups: ParticipantsGroup[]) => {
  const id = (groups.map(d => d.id).sort((a, b) => b - a)[0] ?? 0) + 1
  const name = `Group ${id}`
  const group = {
    id,
    name,
    participantsIds: [],
  }
  participantsGroupsStore.update(groups => [...groups, group])
}

export const removeGroup = (id: number) => {
  participantsGroupsStore.update(groups => groups.filter(d => d.id !== id))
}

/**
 * It must refresh the store when the data is changed.
 * Otherwise, it could happen that after uploading new data,
 * the old groups would be displayed.
 */
data.subscribe(d => {
  participantsGroupsStore.set(getParticipantsGroups())
})
