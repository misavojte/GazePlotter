<script lang="ts">
  import { updateParticipantsGroups } from '$lib/stores/dataStore'
  import {
    addGroup,
    participantsGroupsStore,
  } from '$lib/stores/participantsGroupStore'
  import { addSuccessToast, addErrorToast } from '$lib/stores/toastStore'
  import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup'
  import MajorButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralButtonMinor from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import GeneralPositionControl from '$lib/components/General/GeneralPositionControl/GeneralPositionControl.svelte'
  import { flip } from 'svelte/animate'
  import UserCog from 'lucide-svelte/icons/user-cog'
  import Bin from 'lucide-svelte/icons/trash'
  import GeneralEmpty from '$lib/components/General/GeneralEmpty/GeneralEmpty.svelte'
  import ModalContentParticipantsGroupsChecklist from '$lib/components/Modal/ModalContent/ModalContentParticipantsGroupsChecklist.svelte'

  let participantsGroups: ParticipantsGroup[] = $state([])
  participantsGroupsStore.subscribe(value => (participantsGroups = value))
  let toggledGroup: null | ParticipantsGroup = $state(null)

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
    toggledGroup = null
    addSuccessToast(`Cleared groups.`)
  }

  const handleSubmit = () => {
    updateParticipantsGroups(participantsGroups)
    addSuccessToast(`Set ${participantsGroups.length} groups.`)
  }

  const toggleGroup = (groupId: number | null = null) => {
    console.log(groupId)
    if (groupId === null) {
      toggledGroup = null
      return
    }
    let localToggledGroup = participantsGroups.find(g => g.id === groupId)
    console.log(localToggledGroup)
    if (localToggledGroup === undefined) {
      addErrorToast(`Group not found.`)
      return
    }
    toggledGroup = localToggledGroup
  }
</script>

{#if toggledGroup !== null}
  <ModalContentParticipantsGroupsChecklist
    group={toggledGroup}
    on:click={() => (toggledGroup = null)}
  />
{/if}
{#if participantsGroups.length === 0 && toggledGroup === null}
  <div class="select-wrapper">
    <GeneralEmpty message="No custom groups yet." />
  </div>
{/if}
{#if participantsGroups.length > 0 && toggledGroup === null}
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
              on:click={() => toggleGroup(group.id)}
            >
              <span class="participant-edit-button-inner">
                <UserCog size={'1em'} />
                <span>Add / remove ({group.participantsIds.length})</span>
              </span>
            </GeneralButtonMinor>
          </td>
          <td>
            <div class="button-group">
              <GeneralPositionControl
                isFirst={participantsGroups.indexOf(group) === 0}
                isLast={participantsGroups.indexOf(group) ===
                  participantsGroups.length - 1}
                onMoveUp={() => handleObjectPositionUp(group)}
                onMoveDown={() => handleObjectPositionDown(group)}
              />
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
{#if toggledGroup === null}
  <div class="footer">
    <MajorButton on:click={() => addGroup(participantsGroups)}>
      {participantsGroups.length < 1 ? 'Create' : 'Add'} group</MajorButton
    >
    <!-- TODO: disable save button if store is empty -->
    <MajorButton on:click={resetGroups}>Clear groups</MajorButton>
    <!-- TODO: disable save button if store is equal to data.participantsGroups -->
    <MajorButton isDisabled={false} on:click={handleSubmit}>Save</MajorButton>
  </div>
{/if}

<style>
  .select-wrapper {
    margin-bottom: 1em;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }
  .participant-edit-button-inner {
    display: flex;
    align-items: center;
    font-size: 12px;
    gap: 0.5em;
  }
  th {
    text-align: left;
    font-size: 14px;
    font-weight: bold;
  }
  input {
    height: 34px;
    box-sizing: border-box;
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    margin: 0;
    padding: 0.5rem;
  }
  .button-group {
    display: flex;
    gap: 5px;
    flex-direction: row;
    flex-wrap: nowrap;
  }
  .footer {
    margin-top: 2rem;
  }
</style>
