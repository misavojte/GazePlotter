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
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralButtonMinor from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import { flip } from 'svelte/animate'
  import ListX from 'lucide-svelte/icons/list-x'
  import ArrowDown from 'lucide-svelte/icons/arrow-down'
  import ArrowUp from 'lucide-svelte/icons/arrow-up'
  import UserCog from 'lucide-svelte/icons/user-cog'
  import Bin from 'lucide-svelte/icons/trash'
  import { fly, fade } from 'svelte/transition'
  import ModalContentParticipantsGroupsChecklist from '$lib/components/Modal/ModalContent/ModalContentParticipantsGroupsChecklist.svelte'

  const participants = getParticipants().map(d => d.displayedName)
  let participantsGroups: ParticipantsGroup[] = []
  participantsGroupsStore.subscribe(value => (participantsGroups = value))
  let toggledGroupId: null | number = null

  const handleObjectPositionUp = (group: ParticipantsGroup) => {
    const index = participantsGroups.indexOf(group)
    if (index > 0) {
      participantsGroups = [
        ...participantsGroups.slice(0, index - 1),
        participantsGroups[index],
        participantsGroups[index - 1],
        ...participantsGroups.slice(index + 1),
      ]
    }
  }

  const handleObjectPositionDown = (group: ParticipantsGroup) => {
    const index = participantsGroups.indexOf(group)
    if (index < participantsGroups.length - 1) {
      participantsGroups = [
        ...participantsGroups.slice(0, index),
        participantsGroups[index + 1],
        participantsGroups[index],
        ...participantsGroups.slice(index + 2),
      ]
    }
  }

  const resetGroups = () => {
    participantsGroupsStore.set([])
    updateParticipantsGroups(participantsGroups)
    toggledGroupId = null
    addSuccessToast(`Cleared groups.`)
  }

  const handleSubmit = () => {
    updateParticipantsGroups(participantsGroups)
    addSuccessToast(`Set ${participantsGroups.length} groups.`)
  }
</script>

{#if toggledGroupId !== null}
  <ModalContentParticipantsGroupsChecklist
    group={participantsGroups.find(g => g.id === toggledGroupId)}
    on:click={() => (toggledGroupId = null)}
  />
{/if}
{#if participantsGroups.length === 0 && toggledGroupId === null}
  <div class="select-wrapper">
    <div class="empty">
      <ListX size={'1em'} />
      <span>You did not yet create any groups.</span>
    </div>
  </div>
{/if}
{#if participantsGroups.length > 0 && toggledGroupId === null}
  <table class="grid content">
    <thead>
      <tr class="gr-line header">
        <th>Group Name</th>
        <th>Participants</th>
        <th>Order & delete</th>
      </tr>
    </thead>
    <tbody>
      {#each participantsGroups as group (group.id)}
        <tr class="gr-line" animate:flip>
          <td>
            <input type="text" id={group.id + 'name'} bind:value={group.name} />
          </td>
          <td>
            <GeneralButtonMinor
              isIcon={false}
              on:click={() => (toggledGroupId = group.id)}
            >
              <span class="participant-edit-button-inner">
                <UserCog size={'1em'} />
                <span>Add / remove ({group.participantsIds.length})</span>
              </span>
            </GeneralButtonMinor>
          </td>
          <td>
            <div class="button-group">
              <GeneralButtonMinor
                isDisabled={participantsGroups.indexOf(group) === 0}
                on:click={() => handleObjectPositionUp(group)}
              >
                <ArrowUp size={'1em'} />
              </GeneralButtonMinor>
              <GeneralButtonMinor
                isDisabled={participantsGroups.indexOf(group) ===
                  participantsGroups.length - 1}
                on:click={() => handleObjectPositionDown(group)}
              >
                <ArrowDown size={'1em'} />
              </GeneralButtonMinor>
              <GeneralButtonMinor
                on:click={() => {
                  participantsGroupsStore.set(
                    participantsGroups.filter(g => g.id !== group.id)
                  )
                  addSuccessToast(`Deleted group ${group.name}.`)
                }}
              >
                <Bin size={'1em'} />
              </GeneralButtonMinor>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
{#if toggledGroupId === null}
  <MajorButton on:click={() => addGroup(participantsGroups)}>
    {participantsGroups.length < 1 ? 'Create' : 'Add'} group</MajorButton
  >
{/if}

<div class="footer">
  <!-- TODO: disable save button if store is empty -->
  <MajorButton on:click={resetGroups}>Clear groups</MajorButton>
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
    flex-direction: column;
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
  .participant-edit-button-inner {
    display: flex;
    align-items: center;
    font-size: 12px;
    gap: 0.5em;
  }
  th,
  .title {
    text-align: left;
    font-size: 14px;
    font-weight: bold;
  }
  input {
    height: 34px;
    box-sizing: border-box;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin: 0;
    padding: 0.5rem;
  }
  table {
    margin-bottom: 1em;
  }
</style>
