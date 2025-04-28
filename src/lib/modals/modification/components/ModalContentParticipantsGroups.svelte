<script lang="ts">
  import { updateParticipantsGroups } from '$lib/gaze-data/front-process/stores/dataStore'
  import {
    addGroup,
    participantsGroupsStore,
  } from '$lib/modals/modification/stores/participantsGroupStore'
  import { addSuccessToast, addErrorToast } from '$lib/toaster'
  import type { ParticipantsGroup } from '$lib/type/Data'
  import {
    GeneralButtonMajor,
    GeneralButtonMinor,
  } from '$lib/shared/components'
  import GeneralPositionControl from '$lib/shared/components/GeneralPositionControl.svelte'
  import { flip } from 'svelte/animate'
  import UserCog from 'lucide-svelte/icons/user-cog'
  import Bin from 'lucide-svelte/icons/trash'
  import GeneralEmpty from '$lib/shared/components/GeneralEmpty.svelte'
  import { ModalContentParticipantsGroupsChecklist } from '$lib/modals'

  interface Props {
    forceRedraw: () => void
  }

  let { forceRedraw }: Props = $props()

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
    forceRedraw()
    toggledGroup = null
    addSuccessToast(`Cleared groups.`)
  }

  const handleSubmit = () => {
    updateParticipantsGroups(participantsGroups)
    forceRedraw()
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
    onclick={() => (toggledGroup = null)}
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
              onclick={() => toggleGroup(group.id)}
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
                onclick={() => {
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
    <GeneralButtonMajor onclick={() => addGroup(participantsGroups)}>
      {participantsGroups.length < 1 ? 'Create' : 'Add'} group
    </GeneralButtonMajor>
    <!-- TODO: disable save button if store is empty -->
    <GeneralButtonMajor onclick={resetGroups}>Clear groups</GeneralButtonMajor>
    <!-- TODO: disable save button if store is equal to data.participantsGroups -->
    <GeneralButtonMajor isDisabled={false} onclick={handleSubmit}>
      Save
    </GeneralButtonMajor>
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
