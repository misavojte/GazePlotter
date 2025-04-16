<script lang="ts">
  import { getParticipants } from '$lib/stores/dataStore'
  import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup'
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralInputCheck from '$lib/components/General/GeneralInput/GeneralInputCheck.svelte'

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
  }

  const selectAll = () => {
    group.participantsIds = participants.map((_, i) => i)
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
  <MajorButton onclick={e => onclick(e)}>Return to groups</MajorButton>
  <MajorButton onclick={e => selectAll()}>Select all</MajorButton>
  <MajorButton onclick={e => deselectAll()}>Deselect all</MajorButton>
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
