<script lang="ts">
  import {
    getParticipants,
    updateParticipantsGroups,
  } from '$lib/stores/dataStore.ts'
  import {
    addGroup,
    participantsGroupsStore,
  } from '$lib/stores/participantsGroupStore.ts'
  import { addSuccessToast } from '$lib/stores/toastStore.ts'
  import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup.ts'
  import ListX from 'lucide-svelte/icons/list-x'
  import MajorButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
  import ParticipantsGroupSelect from './ParticipantsGroupSelect.svelte'

  const participants = getParticipants().map(d => d.displayedName)
  let participantsGroups: ParticipantsGroup[] = []
  participantsGroupsStore.subscribe(value => (participantsGroups = value))

  const resetGroups = () => {
    participantsGroupsStore.set([])
    updateParticipantsGroups(participantsGroups)
    addSuccessToast(`Cleared groups.`)
  }

  const handleSubmit = () => {
    updateParticipantsGroups(participantsGroups)
    addSuccessToast(`Set ${participantsGroups.length} groups.`)
  }
</script>

<p>
  The provided data include {participants.length} participants. To assign participants
  to groups create groups first and drag and drop participants into the groups.
</p>
<ul class="participants">
  {#each participants as participant, id}
    <li id={`${participant}-${id}}`}>{participant}</li>
  {/each}
</ul>

<div class="select-wrapper">
  {#if participantsGroups.length === 0}
    <div class="empty">
      <ListX size={'1em'} />
      <span>You did not yet create any groups.</span>
    </div>
  {:else}
    {#each participantsGroups as group}
      <ParticipantsGroupSelect {group} />
    {/each}
  {/if}
</div>

<MajorButton on:click={() => addGroup(participantsGroups)}>
  {participantsGroups.length < 1 ? 'Create' : 'Add'} group</MajorButton
>

<div class="footer">
  <!-- TODO: disable save button if store is empty -->
  <MajorButton on:click={resetGroups}>Reset groups</MajorButton>
  <!-- TODO: disable save button if store is equal to data.participantsGroups -->
  <MajorButton isDisabled={false} on:click={handleSubmit}>Save</MajorButton>
</div>

<style>
  p {
    max-width: 50ch;
  }
  ul.participants {
    display: flex;
    list-style: none;
    padding: 0;
    gap: 0.5em;
    margin-bottom: 2em;
    /* TOOD: extract into new component, tag/chip? */
    & li {
      background-color: #ebebef;
      padding: 0.25em 0.5em;
      border-radius: 3px;
    }
  }
  .select-wrapper {
    margin-bottom: 1em;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }
  /* TOOD: extract into new component, empty? */
  .empty {
    padding: 1em;
    border: 1px solid #ebebef;
    border-radius: 3px;
    color: gray;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
  }
  .footer {
    margin-top: 2em;
  }
</style>
