<script lang="ts">
  import { removeGroup } from '$lib/stores/participantsGroupStore.ts'
  import type { ParticipantsGroup } from '$lib/type/Data/ParticipantsGroup.ts'
  import Pencil from 'lucide-svelte/icons/pencil'
  import Trash from 'lucide-svelte/icons/trash'
  import Ghost from 'lucide-svelte/icons/ghost'

  export let group: ParticipantsGroup
</script>

<div class="wrapper">
  <div class="header">
    <div class="group-name">{group.name}</div>
    <button>
      <Pencil size={'1em'} />
    </button>
    <button on:click={() => removeGroup(group.id)}>
      <Trash size={'1em'} />
    </button>
  </div>
  <div class="drag-zone empty">
    <!-- if empty -->
    <Ghost color="lightgrey" />
    <div>no participants</div>
  </div>
</div>

<style>
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    & :last-child {
      margin-left: auto;
    }
  }
  .group-name {
    font-weight: bold;
  }
  .drag-zone {
    display: flex;
    flex-direction: column;
    place-items: center;
    border: 1px dashed grey;
    border-radius: 3px;
    padding: 0.5em;
    & .empty {
      color: lightgrey;
    }
  }
  button {
    background: white;
    border: none;
    padding: 0.5em;
    border-radius: 3px;
    aspect-ratio: 1;
    border: 1px solid lightgray;
    transition: background 0.25s;
    cursor: pointer;
    &:hover {
      background: lightgray;
    }
  }
</style>
