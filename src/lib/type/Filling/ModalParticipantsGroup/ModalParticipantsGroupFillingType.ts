import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup.ts'

export interface ModalParticipantsGroupType extends ParticipantsGroup {
  id: number
  name: string
  participantsIds: number[]
  type: 'panel' | 'editing'
}
