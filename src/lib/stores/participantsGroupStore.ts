import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup.ts'
import { writable } from 'svelte/store'
import { getParticipantsGroups } from './dataStore.ts'

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
