import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup'

export interface ModalParticipantsGroupType extends ParticipantsGroup {
  id: number
  name: string
  participantsIds: number[]
  type: 'panel' | 'editing'
}
