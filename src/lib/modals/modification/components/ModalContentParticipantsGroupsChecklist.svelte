<script lang="ts">
  import { getParticipants } from '$lib/gaze-data/front-process/stores/dataStore'
  import type { ParticipantsGroup } from '$lib/type/Data'
  import { GeneralButtonMajor } from '$lib/shared/components'
  import GeneralInputCheck from '$lib/shared/components/GeneralInputCheck.svelte'

  interface Props {
    group: ParticipantsGroup
    onclick: (event: MouseEvent) => void
  }

  let { group = $bindable(), onclick }: Props = $props()

  const participants = getParticipants()

  const toggleParticipant = (
    group: ParticipantsGroup,
    participantId: number
  ) => {
    const index = group.participantsIds.indexOf(participantId)
    if (index === -1) {
      // Add participant to the group if not already included
      group.participantsIds = [...group.participantsIds, participantId]
    } else {
      // Remove participant from the group
      group.participantsIds = group.participantsIds.filter(
        id => id !== participantId
      )
    }
    // Force update by creating a new array reference
    group.participantsIds = [...group.participantsIds]
  }

  const selectAll = () => {
    group.participantsIds = [...participants.map((_, i) => i)]
  }

  const deselectAll = () => {
    group.participantsIds = []
  }
</script>

<div class="space-between">
  <span class="title">
    Participants of {group.name}
  </span>
</div>
<ul class="participants">
  {#each participants as participant (participant.id)}
    <li>
      <GeneralInputCheck
        checked={group.participantsIds.includes(participant.id)}
        label={participant.displayedName}
        onchange={() => toggleParticipant(group, participant.id)}
      />
    </li>
  {/each}
</ul>
<div class="footer">
  <GeneralButtonMajor onclick={e => onclick(e)}
    >Return to groups</GeneralButtonMajor
  >
  <GeneralButtonMajor onclick={e => selectAll()}>Select all</GeneralButtonMajor>
  <GeneralButtonMajor onclick={e => deselectAll()}>
    Deselect all
  </GeneralButtonMajor>
</div>

<style>
  .space-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  ul.participants {
    display: flex;
    list-style: none;
    padding: 0;
    gap: 0.5em;
    margin-bottom: 2em;
    flex-direction: column;
  }
  .title {
    text-align: left;
    font-size: 14px;
    font-weight: bold;
  }
  .footer {
    margin-top: 2em;
  }
</style>
