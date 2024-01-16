<script lang="ts">
  import { getParticipants } from '$lib/stores/dataStore.ts'
  import GeneralButtonMinor from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import UserCog from 'lucide-svelte/icons/user-cog'
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'

  export let group: ParticipantsGroup

  const participants = getParticipants().map(d => d.displayedName)

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
  {#each participants as participant, participantId}
    <li id={`${participant}-${participantId}`}>
      <input
        type="checkbox"
        checked={group.participantsIds.includes(participantId)}
        on:change={() => toggleParticipant(group, participantId)}
      />
      <span>{participant}</span>
    </li>
  {/each}
</ul>
<MajorButton on:click>Return to groups</MajorButton>
<MajorButton on:click={selectAll}>Select all</MajorButton>
<MajorButton on:click={deselectAll}>Deselect all</MajorButton>

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
</style>
